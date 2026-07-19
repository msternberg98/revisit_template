import * as d3 from 'd3';
import * as JSZip from "jszip";
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { createScales, shiftedLongitude, unshiftedLongitude } from "../mapUtils";
import { ClimateData } from "../types";

export interface ScaledGlyphOptions {
    preset?: DatasetPreset;
    output?: "valuePlot" | "valueLegend" | "Value" | "uncertaintyPlot" | "uncertaintyLegend" | "Uncertainty" | "scaledGlyphPlot" | "scaledGlyphLegend" | "ScaledGlyph" | "ScaledGlyphRegions" | "all";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawScaledGlyph (container: HTMLDivElement, options: ScaledGlyphOptions = {}) {
    
    const {
        preset = "temperature",
        output = "scaledGlyphPlot"
    } = options;
    
    container.innerHTML = '';

    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    const valueExtent = d3.extent (data, d => d [valueKey]) as [number, number];
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];
     
    const aggregationFactor: number = 1

        const uniqueLongitudes = Array.from (new Set(data.map (d => d.longitude))).sort ((a, b) => a - b);
        const uniqueLatitudes = Array.from (new Set(data.map (d => d.latitude))).sort ((a, b) => a - b);
    
        const longitudeIndex = new Map (uniqueLongitudes.map ((lon, i) => [lon, i]));
        const latitudeIndex = new Map (uniqueLatitudes.map ((lat, i) => [lat, i]));
    
        const aggregatedData = (() => {
    
            if (aggregationFactor === 1) {
    
                return data.map (d => ({
    
                    ...d,
                    sourceValues: [d]
                }));
            }
    
            const groups = d3.rollups (data,
    
                values => ({
                    ...values [0],
                    [valueKey]: d3.mean (values, d => d [valueKey])!,
                    uncertainty_std: d3.mean (values, d => d.uncertainty_std)!,
                    sourceValues: values
                }),
    
                d => Math.floor ((longitudeIndex.get (d.longitude) ?? 0) / aggregationFactor),
                d => Math.floor ((latitudeIndex.get (d.latitude) ?? 0) / aggregationFactor)
            );
    
            return groups.flatMap (([xBin, rows]) =>
    
                rows.map (([yBin, v]) => ({
                    ...v,
                    longitude: uniqueLongitudes [Math.min (xBin * aggregationFactor, uniqueLongitudes.length - 1)],
                    latitude: uniqueLatitudes [Math.min (yBin * aggregationFactor, uniqueLatitudes.length - 1)],
                }))
            );
        })();

    const valueSteps = 8;
    const uncertaintySteps = 6;
    const useDiscrete = false;

    const valueColorScale = useDiscrete
        ? d3.scaleQuantize <string> ()
            .domain (valueExtent)
            .range (d3.range (valueSteps).map ((i) => d3.interpolateViridis (i / (valueSteps - 1)),),)
        : d3.scaleSequential <string> ()
            .domain (valueExtent)
            .interpolator (d3.interpolateViridis);

    const uncertaintyScale = useDiscrete
            ? d3.scaleQuantize <number> ()
                .domain (uncertaintyExtent)
                .range (d3.range(uncertaintySteps))
            : d3.scaleLinear ()
                .domain (uncertaintyExtent)
                .range ([0, uncertaintySteps - 1]);
    
    const width = 1200;
    const cellWidth = 6.35;
    const height = 600;
    const cellHeight = 6.35;

    const glyphSize = aggregationFactor * cellWidth
    const glyphMaxRadius = 12

    const { xScale, yScale } = createScales (data, width, height);

    const onClickPoint = options.onClickPoint;
    
    function createRasterPlot (colorFunction: (d: typeof data [number]) => string): SVGSVGElement {
        
            const svg = d3.create <SVGSVGElement> ("svg")
                .attr ("width", width)
                .attr ("height", height);
    
            const zoomGroup = svg.append("g");
            const zoom = d3.zoom <SVGSVGElement, unknown> ()
                .scaleExtent ([1, 20])
                .translateExtent ([[-20, -20], [width + 20, height + 20]])
                .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
                svg.call (zoom);
    
            const rects = zoomGroup.selectAll ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", (d) => xScale (shiftedLongitude (d.longitude)))
            .attr ("y", (d) => yScale (d.latitude) - cellHeight / 2)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", colorFunction);

        const selectionLayer = zoomGroup.append ("g")
            .attr ("class", "selection-layer");

        rects.on ("click", function (event, d) {

                event.stopPropagation ();
                selectionLayer.selectAll ("*").remove ();
                selectionLayer.append ("rect")
                    .attr ("class", "selection-marker")
                    .attr ("x", xScale (shiftedLongitude (d.longitude)))
                    .attr ("y", yScale (d.latitude) - cellHeight / 2)
                    .attr ("width", cellWidth)
                    .attr ("height", cellHeight)
                    .attr ("fill", "none")
                    .attr ("stroke", "black")
                    .attr ("stroke-width", 0.4)
                    .attr ("pointer-events", "none");

                onClickPoint?.({

                    latitude: d.latitude,
                    longitude: d.longitude,
                    meanValue: d [valueKey] as number,
                    uncertaintyStd: d.uncertainty_std,
                    sourceValues: [{
                        latitude: d.latitude,
                        longitude: d.longitude,
                        mean_temperature: d.mean_temperature,
                        uncertainty_std: d.uncertainty_std
                    }]
                });
            })
    
            return svg.node () as SVGSVGElement;
        }

    const valuePlot = createRasterPlot (d => valueColorScale (d [valueKey]!));

    const valueLegend = (() => {

        const legendWidth = 130;
        const legendHeight = 380;
        const topMargin = 15;

        const steps = useDiscrete
            ? valueSteps
            : 100;

        const svg = d3.create ("svg")
            .attr ("width", legendWidth)
            .attr ("height", legendHeight);

        const usableHeight = legendHeight - topMargin;
        const stepHeight = usableHeight / steps;

        for (let i = 0; i < steps; i++) {

            const value = i / (steps - 1);

            svg.append ("rect")
            .attr ("x", 20)
            .attr ("y", topMargin + usableHeight - (i + 1) * stepHeight)
            .attr ("width", 30)
            .attr ("height", stepHeight)
            .attr ("fill", d3.interpolateViridis(value));
        }

        const labelSteps = 6;

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0]);

            const y = topMargin + usableHeight - t * usableHeight;

            svg.append ("text")
                .attr ("x", 60)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`)
        }

        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            .text (config.valueLabel)

        return svg.node () as SVGSVGElement;
    })();

    function drawScaledGlyphs (g: d3.Selection <SVGGElement, any, any, any>, uncertainty: number) {

        const uncertaintyFactor = (uncertainty - uncertaintyExtent [0]) / (uncertaintyExtent [1] - uncertaintyExtent [0])

        const minRadius = glyphSize * 0.1
        const maxRadius = glyphSize * 0.5

        const radius = minRadius + uncertaintyFactor * (maxRadius - minRadius)

        g.append ("circle")
            .attr ("r", radius)
            .attr ("fill", "none")
            .attr ("stroke", "black")
            .attr ("stroke-width", 0.2)
    }

    const uncertaintyPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);

        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, unknown> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
            svg.call (zoom);

        const glyphGroup = zoomGroup.append ("g")
            .selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth / 2},${yScale (d.latitude) + 1})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement);
                g.append ("circle")
                    .attr ("r", cellWidth * 0.5)
                    .attr ("fill", "transparent")
                    .style ("pointer-events", "all");
                drawScaledGlyphs (g, d.uncertainty_std);
            });

        const glyphSelectionLayer = zoomGroup.append("g")
            .attr ("class", "glyph-selection-layer");
        
        glyphGroup.on ("click", function (event, d) {

            event.stopPropagation ();
            glyphSelectionLayer.selectAll ("*").remove ();
            glyphSelectionLayer.append ("rect")
                .attr ("class", "selection-marker")
                .attr ("x", xScale (shiftedLongitude (d.longitude)))
                .attr ("y", yScale (d.latitude) - cellHeight / 2)
                .attr ("width", cellWidth)
                .attr ("height", cellHeight)
                .attr ("fill", "none")
                .attr ("stroke", "black")
                .attr ("stroke-width", 0.4)
                .attr ("pointer-events", "none");

            onClickPoint?.({

                latitude: d.latitude,
                longitude: d.longitude,
                meanValue: d [valueKey] as number,
                uncertaintyStd: d.uncertainty_std,
                sourceValues: d.sourceValues.map (v => ({
                    latitude: v.latitude,
                    longitude: v.longitude,
                    mean_temperature: v.mean_temperature,
                    uncertainty_std: v.uncertainty_std
                }))
            });
        });
        return svg.node () as SVGSVGElement;
    })();

    const uncertaintyLegend = (() => {

        const width = 220;
        const height = 380;

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);

        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 50 + (uncertaintySteps - 1 - level) * 60;
            const g = svg.append ("g").attr( "transform", `translate(50,${y})`);

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            drawScaledGlyphs (g, uncertaintyValue);

            svg.append ("text")
                .attr ("x", 90)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                .text ((uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals));
        }

        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            .text (config.uncertaintyLabel);

        return svg.node () as SVGSVGElement;
    })();

    const scaledGlyphPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);
        
        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, unknown> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
            svg.call (zoom);

        // Hintergrund = Mittelwert
        zoomGroup.selectAll ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", d => xScale (shiftedLongitude (d.longitude)))
            .attr ("y", d => yScale (d.latitude) - cellHeight / 2)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", d => valueColorScale (d [valueKey]!))

        // Glyphen darüber
        const glyphGroup = zoomGroup.append ("g")
            .selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth / 2},${yScale (d.latitude)})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement); 
                g.append ("rect")
                    .attr ("x", -cellWidth / 2)
                    .attr ("y", -cellHeight / 2)
                    .attr ("width", cellWidth)
                    .attr ("height", cellHeight)
                    .attr ("fill", "transparent")
                    .style ("pointer-events", "all");
                drawScaledGlyphs (g, d.uncertainty_std);
            });
        
        const glyphSelectionLayer = zoomGroup.append("g")
            .attr ("class", "glyph-selection-layer");
        
        glyphGroup.on ("click", function (event, d) {

            event.stopPropagation ();
            glyphSelectionLayer.selectAll ("*").remove ();
            glyphSelectionLayer.append ("rect")
                .attr ("class", "selection-marker")
                .attr ("x", xScale (shiftedLongitude (d.longitude)))
                .attr ("y", yScale (d.latitude) - cellHeight / 2)
                .attr ("width", cellWidth)
                .attr ("height", cellHeight)
                .attr ("fill", "none")
                .attr ("stroke", "black")
                .attr ("stroke-width", 0.4)
                .attr ("pointer-events", "none");

            onClickPoint?.({

                latitude: d.latitude,
                longitude: d.longitude,
                meanValue: d [valueKey] as number,
                uncertaintyStd: d.uncertainty_std,
                sourceValues: d.sourceValues.map (v => ({
                    latitude: v.latitude,
                    longitude: v.longitude,
                    mean_temperature: v.mean_temperature,
                    uncertainty_std: v.uncertainty_std
                }))
            });
        });
        return svg.node () as SVGSVGElement;
    })();

    const scaledGlyphLegend = (() => {

        const legendWidth = 240;
        const legendHeight = 380;
        const topMargin = 15;

        const svg = d3.create ("svg")
            .attr ("width", legendWidth)
            .attr ("height", legendHeight);

        const usableHeight = legendHeight - topMargin;

        const steps = useDiscrete
            ? valueSteps
            : 100;

        const stepHeight = usableHeight / steps;

        // VALUE SCALE

        for (let i = 0; i < steps; i++) {

            const value = i / (steps - 1);

            svg.append ("rect")
                .attr ("x", 20)
                .attr ("y", topMargin + usableHeight - (i + 1) * stepHeight)
                .attr ("width", 25)
                .attr ("height", stepHeight)
                .attr ("fill", d3.interpolateViridis (value));
        }

        const labelSteps = 6;

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0]);

            const y = topMargin + usableHeight - t * usableHeight;

            svg.append ("text")
                .attr ("x", 55)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`);
        }

        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            .text (config.valueLabel);

        // UNCERTAINTY SCALE

        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 55 + (uncertaintySteps - 1 - level) * 60;

            const g = svg.append ("g").attr ("transform", `translate(130,${y})`);

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            drawScaledGlyphs (g, uncertaintyValue);

            svg.append ("text")
                .attr ("x", 155)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                .text (`${(uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)} ${config.unit}`);
        }

        svg.append ("text")
            .attr ("x", 145)
            .attr ("y", 10)
            .attr ("text-anchor", "middle")
            .attr ("font-size", 12)
            .text (config.uncertaintyLabel);

        return svg.node ()!;

    })();

    const scaledGlyphRegionsPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);
        
        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, unknown> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
            svg.call (zoom);

        // Hintergrund = Mittelwert
        zoomGroup.selectAll ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", d => xScale (shiftedLongitude (d.longitude)))
            .attr ("y", d => yScale (d.latitude) - cellHeight / 2)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", d => valueColorScale (d [valueKey]!))

        // Glyphen darüber
        const glyphGroup = zoomGroup.append ("g")
            .selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth / 2},${yScale (d.latitude)})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement); 
                g.append ("rect")
                    .attr ("x", -cellWidth / 2)
                    .attr ("y", -cellHeight / 2)
                    .attr ("width", cellWidth)
                    .attr ("height", cellHeight)
                    .attr ("fill", "transparent")
                    .style ("pointer-events", "all");
                drawScaledGlyphs (g, d.uncertainty_std);
            });
        
        const regionLayer = zoomGroup.append ("g")
            .attr ("class", "region-layer");

        const regions = [
            {
                //Region 1: mean value -13.1901; mean uncertainty 5.4356
                latitudeMin: 77.4058880820788,
                latitudeMax: 84.86197029204237,
                longitudeMin: 9.375,
                longitudeMax: 16.875
            },
            {
                //Region 2: mean value -1.2391; mean uncertainty 3.1356
                latitudeMin: 49.42915369712305,
                latitudeMax: 56.89001260135711,
                longitudeMin: 22.5,
                longitudeMax: 30
            },
            {
                //Region 3: mean value 0.4607; mean uncertainty 1.4989 
                latitudeMin: 41.96822026907538,
                latitudeMax: 49.42915369712305,
                longitudeMin: 296.25,
                longitudeMax: 303.75
            },
            {
                //Region 4: mean value -20.0962; uncertainty 1.4297
                latitudeMin: -84.86197029204237,
                latitudeMax: -77.4058880820788,
                longitudeMin: 275.625,
                longitudeMax: 283.125
            },
            {
                //Region 5: mean value 2.7040; uncertainty 0.6454
                latitudeMin: 49.42915369712305,
                latitudeMax: 56.89001260135711,
                longitudeMin: 166.875,
                longitudeMax: 174.375
            }
        ];
        
        regions.forEach ((region, index) => {

            const x1 = xScale (shiftedLongitude (region.longitudeMin));
            const x2 = xScale (shiftedLongitude (region.longitudeMax)) + cellWidth;

            const y1 = yScale (region.latitudeMax) - cellHeight / 2;
            const y2 = yScale (region.latitudeMin) + cellHeight / 2;

            const x = Math.min (x1, x2);
            const y = Math.min (y1, y2);
            const width = Math.abs (x2 - x1);
            const height = Math.abs (y2 - y1);

            regionLayer.append ("rect")
                .attr ("x", x)
                .attr ("y", y)
                .attr ("width", width)
                .attr ("height", height)
                .attr ("fill", "none")
                .attr ("stroke", "black")
                .attr ("stroke-width", 0.5)
                .attr ("pointer-events", "none");

            regionLayer.append ("text")
                .attr ("x", x + width / 2)
                .attr ("y", y - 5)
                .attr ("text-anchor", "middle")
                .attr ("dominant-baseline", "auto")
                .attr ("font-size", 14)
                .attr ("font-weight", "bold")
                .attr ("fill", "black")
                .attr ("pointer-events", "none")
                .text (`R${index + 1}`);
        });
        return svg.node () as SVGSVGElement;
    })();

    function createExportAllPlots (
        plots: Array <[string, SVGElement]>,
        width: number,
        height: number
        ) {
        const button = document.createElement ("button");
        button.innerText = "Download All Plots";

        button.onclick = async () => {
            const zip = new JSZip ();
            const serializer = new XMLSerializer ();

            for (const [name, plot] of plots) {
                // SVG export
                const svgSource = serializer.serializeToString (plot);
                zip.file (`${name}.svg`, svgSource);

                // PNG export via canvas
                const canvas = document.createElement ("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext ("2d");
                if (!ctx) continue;

                const img = new Image ();
                const svgBlob = new Blob ([svgSource], {type: "image/svg+xml;charset=utf-8",});

                const url = URL.createObjectURL (svgBlob);

                await new Promise<void> ((resolve) => {
                    img.onload = () => {
                    ctx.drawImage (img, 0, 0);
                    canvas.toBlob ((blob) => {
                        if (blob) zip.file (`${name}.png`, blob);
                        URL.revokeObjectURL (url);
                        resolve ();
                    });
                    };

                    img.src = url;
                });
            }

            const blob = await zip.generateAsync ({ type: "blob" });

            const url = URL.createObjectURL (blob);

            const a = document.createElement ("a");
            a.href = url;
            a.download = "ScaledGlyph_Plots.zip";
            a.click ();

            URL.revokeObjectURL (url);
        };

        return button;
    }
    
    switch (output) {

        case "valuePlot":
            container.appendChild (valuePlot);
            break;

        case "valueLegend":
            container.appendChild (valueLegend);
            break;

        case "Value":
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            break;

        case "uncertaintyPlot":
            container.appendChild (uncertaintyPlot);
            break;

        case "uncertaintyLegend":
            container.appendChild (uncertaintyLegend);
            break;

        case "Uncertainty":
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            break;

        case "scaledGlyphPlot":
            container.appendChild (scaledGlyphPlot);
            break;

        case "scaledGlyphLegend":
            container.appendChild (scaledGlyphLegend);
            break;
        
        case "ScaledGlyph":
            container.appendChild (scaledGlyphPlot);
            container.appendChild (scaledGlyphLegend);
            break;

        case "ScaledGlyphRegions":
            container.appendChild (scaledGlyphRegionsPlot);
            container.appendChild (scaledGlyphLegend);
            break;

        case "all":
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            container.appendChild (scaledGlyphPlot);
            container.appendChild (scaledGlyphLegend);
            container.appendChild (scaledGlyphRegionsPlot)
            break;

        default:
            container.appendChild(scaledGlyphPlot);
            break;
    }
}