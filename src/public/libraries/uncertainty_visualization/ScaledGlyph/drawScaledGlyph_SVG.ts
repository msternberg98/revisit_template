import * as d3 from 'd3';
import JSZip from "jszip";
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

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    const valueExtent = d3.extent (data, d => d [valueKey]) as [number, number];
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];
     
    // Aggregation
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

    // Diskrete Schritte
    const valueSteps = 8;
    const uncertaintySteps = 6;
    const useDiscrete = false;

    // Farbskala
    const valueColorScale = useDiscrete
        ? d3.scaleQuantize <string> ()
            .domain (valueExtent)
            .range (d3.range (valueSteps).map ((i) => d3.interpolateViridis (i / (valueSteps - 1)),),)
        : d3.scaleSequential <string> ()
            .domain (valueExtent)
            .interpolator (d3.interpolateViridis);
    
    // Plot Größen
    const width = 1200;
    const cellWidth = 6.35;
    const height = 600;
    const cellHeight = cellWidth;
    const glyphSize = aggregationFactor * cellWidth

    // Longitude Shift
    const { xScale, yScale } = createScales (data, width, height);

    const onClickPoint = options.onClickPoint;
    
    // Raster Plot
    function createRasterPlot (colorFunction: (d: typeof data [number]) => string): SVGSVGElement {
        
            const svg = d3.create <SVGSVGElement> ("svg")
                .attr ("width", width)
                .attr ("height", height);
    
            const zoomGroup = svg.append("g");
            const zoom = d3.zoom <SVGSVGElement, undefined> ()
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
                .attr ("fill", colorFunction)
                .attr ("shape-rendering", "crispEdges");

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
                    .attr ("stroke", "#FF00FF")
                    .attr ("stroke-width", 0.8)
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

    // Datensatz Werte Plot
    const valuePlot = createRasterPlot (d => valueColorScale (d [valueKey]!));

    // Datensatz Werte Legende
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
                .attr ("fill", d3.interpolateViridis (value))
                .attr ("shape-rendering", "crispEdges");
        }

        const labelSteps = 6;

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);
            const y = topMargin + usableHeight - t * usableHeight;

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0]);

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

    // Skalierte Glyphen
    function drawScaledGlyphs (g: d3.Selection <SVGGElement, any, any, any>, uncertainty: number) {

        const uncertaintyFactor = (uncertainty - uncertaintyExtent [0]) / (uncertaintyExtent [1] - uncertaintyExtent [0])

        const minRadius = glyphSize * 0.1
        const maxRadius = glyphSize * 0.5
        const radius = minRadius + uncertaintyFactor * (maxRadius - minRadius)

        g.append ("circle")
            .attr ("r", radius)
            .attr ("fill", "none")
            .attr ("stroke", "#FF00FF")
            .attr ("stroke-width", 0.2)
    }

    // Datensatz Unsicherheit Plot
    const uncertaintyPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);

        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, undefined> ()
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
                .attr ("stroke", "#FF00FF")
                .attr ("stroke-width", 0.8)
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

    // Datensatz Unsicherheit Legende
    const uncertaintyLegend = (() => {

        const width = 220;
        const height = 380;

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);

        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 50 + (uncertaintySteps - 1 - level) * 60;
            const g = svg.append ("g").attr ("transform", `translate(50,${y})`);

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            drawScaledGlyphs (g, uncertaintyValue);

            svg.append ("text")
                .attr ("x", 80)
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

    // Scaled Glyph Plot
    const scaledGlyphPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);
        
        const zoomGroup = svg.append ("g");
        const zoom = d3.zoom <SVGSVGElement, undefined> ()
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
            .attr ("shape-rendering", "crispEdges");

        // Glyphen darüber
        const glyphGroup = zoomGroup.append ("g")
            .selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth / 2},${yScale (d.latitude)})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement); 
                g.append ("rect")  // Fehler mit Positionierung der unsichtbaren rects, aber ohnehin wechsel zu PNGs.
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
                .attr ("stroke", "#FF00FF")
                .attr ("stroke-width", 0.8)
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

    // Scaled Glyph Legende
    const scaledGlyphLegend = (() => {

        const legendWidth = 240;
        const legendHeight = 380;
        const topMargin = 15;

        const svg = d3.create ("svg")
            .attr ("width", legendWidth)
            .attr ("height", legendHeight);

        const usableHeight = legendHeight - topMargin;

        // Wert Legende
        const steps = useDiscrete
            ? valueSteps
            : 100;
        const stepHeight = usableHeight / steps;
        const labelSteps = 6;

        for (let i = 0; i < steps; i++) {

            const value = i / (steps - 1);

            svg.append ("rect")
                .attr ("x", 20)
                .attr ("y", topMargin + usableHeight - (i + 1) * stepHeight)
                .attr ("width", 25)
                .attr ("height", stepHeight)
                .attr ("fill", d3.interpolateViridis (value))
                .attr ("shape-rendering", "crispEdges");
        }

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);
            const y = topMargin + usableHeight - t * usableHeight;

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0]);

            svg.append ("text")
                .attr ("x", 55)
                .attr ("y", y + 4)
                .attr ("font-size", 13)
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`);
        }

        // Werte Label
        svg.append ("text")
            .attr ("x", 10)
            .attr ("y", 10)
            .attr ("font-size", 14)
            .text (config.valueLabel);

        // Skalierte Glyphen
        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 55 + (uncertaintySteps - 1 - level) * 60;
            const g = svg.append ("g").attr ("transform", `translate(130,${y})`);

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            drawScaledGlyphs (g, uncertaintyValue);

            svg.append ("text")
                .attr ("x", 165)
                .attr ("y", y + 4)
                .attr ("font-size", 13)
                .text (`${(uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)} ${config.unit}`);
        }

        svg.append ("text")
            .attr ("x", 160)
            .attr ("y", 10)
            .attr ("text-anchor", "middle")
            .attr ("font-size", 14)
            .text (config.uncertaintyLabel);

        return svg.node () as SVGSVGElement
    })();

    // Scaled Glyph Plot mit Regionen
    const scaledGlyphPlotRegions = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);
        
        const zoomGroup = svg.append ("g");
        const zoom = d3.zoom <SVGSVGElement, undefined> ()
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
            .attr ("shape-rendering", "crispEdges");

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
                //Region 1: mean value -13.324312746; deviation 1.324312746; mean uncertainty 5.06290306
                latitudeMin: 56.89001260135711,
                latitudeMax: 64.35073040887207,
                longitudeMin: 200.625,
                longitudeMax: 208.125
            },
            {
                //Region 2: mean value -0.9009721432; deviation 11.0990278568; mean uncertainty 3.080212368
                latitudeMin: 38.23773599056483,
                latitudeMax: 45.698693877701785,
                longitudeMin: 281.25,
                longitudeMax: 288.75
            },
            {
                //Region 3: mean value 0.619351364; deviation 12.619351364; mean uncertainty 1.5227066124
                latitudeMin: 68.08099098565125,
                latitudeMax: 75.54106145287895,
                longitudeMin: 28.125,
                longitudeMax: 35.625
            },
            {
                //Region 4: mean value -19.99693754000; deviation 7.99693754000; uncertainty 1.455844682
                latitudeMin: -77.4058880820788,
                latitudeMax: -69.94608064698343,
                longitudeMin: 0,
                longitudeMax: 7.5
            },
            {
                //Region 5: mean value 2.77247876000; deviation 14.77247876000; uncertainty 0.650520978
                latitudeMin: -66.2158721139987,
                latitudeMax: -58.75520926937993,
                longitudeMin: 97.5,
                longitudeMax: 105
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
                .attr ("x", x - 12)
                .attr ("y", y + 5 + height / 2)
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

    async function renderSvgToCanvas (
        svg: SVGElement,
        width: number,
        height: number,
        scale = 7  // 7 für Plot, 20 für Legende
        ): Promise <HTMLCanvasElement> {

        const serializer = new XMLSerializer ();
        const svgSource = serializer.serializeToString (svg);

        const canvas = document.createElement ("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext ("2d");

        if (!ctx) {throw new Error ("Canvas Context konnte nicht erzeugt werden.");}

        ctx.scale (scale, scale);

        const img = new Image ();

        const blob = new Blob (
            [svgSource],
            { type: "image/svg+xml;charset=utf-8" }
        );

        const url = URL.createObjectURL (blob);

        await new Promise <void> ((resolve) => {

            img.onload = () => {

                ctx.drawImage (img, 0, 0);
                URL.revokeObjectURL (url);
                resolve ();
            };
            img.src = url;
        });
        return canvas;
    }

    // Datei Namen für Export
    const datasetName = valueKey === "mean_temperature"
        ? "Temperature"
        : valueKey === "mean_precipitation"
        ? "Precipitation"
        : valueKey === "mean_air_pressure"
        ? "Air_Pressure"
        : valueKey;

    // Export Button
    function createExportAllPlots (plots: Array <[string, SVGElement, number, number]>) {
        const button = document.createElement ("button");
        button.innerText = "Download All Plots";

        button.onclick = async () => {
            const zip = new JSZip ();
            const serializer = new XMLSerializer ();

            for (const [name, plot, width, height] of plots) {
                // SVG export
                const svgSource = serializer.serializeToString (plot);
                zip.file (`${name}.svg`, svgSource);

                // PNG export
                const canvas = await renderSvgToCanvas (plot, width, height);

                await new Promise <void> ((resolve) => {

                    canvas.toBlob ((blob) => {

                        if (blob) {
                            zip.file (`${name}.png`, blob);
                        }

                        resolve ();
                    },
                    "image/png",
                    1.0
                    );
                });
            }

            const blob = await zip.generateAsync ({ type: "blob" });

            const url = URL.createObjectURL (blob);

            const a = document.createElement ("a");
            a.href = url;
            a.download = `${datasetName}_ScaledGlyph_Plots.zip`;
            a.click ();

            URL.revokeObjectURL (url);
        };

        return button;
    }
    
    // Container Switch
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
            container.appendChild (scaledGlyphPlotRegions);
            container.appendChild (scaledGlyphLegend);
            break;

        case "all":
            // container.appendChild (valuePlot);
            // container.appendChild (valueLegend);
            // container.appendChild (uncertaintyPlot);
            // container.appendChild (uncertaintyLegend);
            // container.appendChild (scaledGlyphPlot);
            // container.appendChild (scaledGlyphLegend);
            // container.appendChild (scaledGlyphPlotRegions)
            
            container.appendChild (createExportAllPlots (
                    [
                        [`${datasetName}_Value_Plot`, valuePlot, 1200, 600],
                        [`${datasetName}_Value_Legende`, valueLegend, 130, 380],
                        [`${datasetName}_Uncertainty_Plot`, uncertaintyPlot, 1200, 600],
                        [`${datasetName}_Uncertainty_Legende`, uncertaintyLegend, 220, 380],
                        [`${datasetName}_ScaledGlyph_Plot`, scaledGlyphPlot, 1200, 600],
                        [`${datasetName}_ScaledGlyph_Legende`, scaledGlyphLegend, 240, 380],
                        [`${datasetName}_ScaledGlyph_Regions`, scaledGlyphPlotRegions, 1200, 600]
                    ],
                )
            );

            break;

        default:
            container.appendChild(scaledGlyphPlot);
            break;
    }
}