import * as d3 from 'd3';
import * as JSZip from "jszip";
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { createScales, shiftedLongitude } from "../mapUtils";

export interface IsoGlyphOptions {
    preset?: DatasetPreset;
    output?: "valuePlot" | "valueLegend" | "Value" | "uncertaintyPlot" | "uncertaintyLegend" | "Uncertainty" | "isoGlyphPlot" | "isoGlyphLegend" | "IsoGlyph" | "IsoGlyph+" | "all";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
    }) => void;
}

export async function drawIsoGlyph (container: HTMLDivElement, options: IsoGlyphOptions = {}) {
     
    const {
        preset = "temperature",
        output = "isoGlyphPlot"
    } = options;
    
    container.innerHTML = '';

    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    const valueExtent = d3.extent (data, d => d [valueKey]) as [number, number];
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];
     
    const aggregationFactor: number = 2
    const aggregatedData = (() => {

        if (aggregationFactor === 1) {
            return data;
        }

        const groups = d3.rollups (data, values => ({...values [0],
                [valueKey]: d3.mean (values, d => d [valueKey])!,
                uncertainty_std: d3.mean (values, d => d.uncertainty_std)!

            }),
            d => Math.floor (d.longitude / aggregationFactor),
            d => Math.floor (d.latitude / aggregationFactor)
        );

        return groups.flatMap (([xBin, rows]) => rows.map (([yBin, v]) => ({...v,
                longitude: (xBin + 0.5) * aggregationFactor,
                latitude: (yBin + 0.5) * aggregationFactor
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
    const cellWidth = 8;
    const height = 600;
    const cellHeight = 8;
    const glyphSize = aggregationFactor * cellWidth * 0.4375
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
            svg.on ("click", function (event) {
            
                const [x, y] = d3.pointer (event, this);
                const transform = d3.zoomTransform (this as SVGSVGElement);
                const originalX = transform.invertX (x);
                const originalY = transform.invertY (y);
                const longitude = xScale.invert (originalX);
                const latitude = yScale.invert (originalY);
                const nearest = data.reduce ((closest, current) => {
            
                    const currentDistance = Math.abs (current.longitude - longitude) + Math.abs (current.latitude - latitude);
                    const closestDistance = Math.abs (closest.longitude - longitude) + Math.abs (closest.latitude - latitude);
                    return currentDistance < closestDistance ? current : closest;
                }, data [0]);
            
                onClickPoint?.({
            
                latitude: nearest.latitude,
                longitude: nearest.longitude,
                meanValue: nearest [valueKey] as number,
                uncertaintyStd: nearest.uncertainty_std,
                });            
            });

        zoomGroup.selectAll ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", (d) => xScale (shiftedLongitude (d.longitude)))
            .attr ("y", (d) => yScale (d.latitude) - cellHeight / 2)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", colorFunction);

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

    function drawIsoGlyphs (g: d3.Selection <SVGGElement, any, any, any>, size: number, uncertainty: number) {

        const uncertaintyFactor = (uncertainty - uncertaintyExtent [0]) / (uncertaintyExtent [1] - uncertaintyExtent [0])
        const clampedFactor = Math.max (0, Math.min (1, uncertaintyFactor))

        const baseGray = 0.5
        const squareColor = d3.interpolateGreys (Math.min (1, baseGray + clampedFactor * 0.45))
        const outerRingColor = d3.interpolateGreys (baseGray)
        const innerRingColor = d3.interpolateGreys (Math.max (0, baseGray - clampedFactor * 0.45))

        // Quadrat (+ uncertainty)
        g.append ("rect")
            .attr ("x", -size / 2)
            .attr ("y", -size / 2)
            .attr ("width", size)
            .attr ("height", size)
            .attr ("fill", squareColor)

        // Außenkreis (mean)
        g.append ("circle")
            .attr ("r", size * 0.4)
            .attr ("fill", outerRingColor)

        // Innenkreis (- uncertainty)
        g.append ("circle")
            .attr ("r", size * 0.2)
            .attr ("fill", innerRingColor)
    }

    function drawIsoGlyphsColored (g: d3.Selection <SVGGElement, any, any, any>, size: number, value: number, uncertainty: number) {

        const upperValue = Math.min (valueExtent [1], value + uncertainty)
        const lowerValue = Math.max (valueExtent [0], value - uncertainty)

        const outerRingColor = valueColorScale (value)
        const squareColor = valueColorScale (upperValue)
        const innerRingColor = valueColorScale (lowerValue)

        // Quadrat (mean + uncertainty)
        g.append ("rect")
            .attr ("x", -size / 2)
            .attr ("y", -size / 2)
            .attr ("width", size)
            .attr ("height", size)
            .attr ("fill", squareColor)

        // Außenkreis (mean)
        g.append ("circle")
            .attr ("r", size * 0.4)
            .attr ("fill", outerRingColor)

        // Innenkreis (mean - uncertainty)
        g.append ("circle")
            .attr ("r", size * 0.2)
            .attr ("fill", innerRingColor)
    }

    const uncertaintyPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height)

        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, unknown> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
            svg.call (zoom);
            svg.on ("click", function (event) {
            
                const [x, y] = d3.pointer (event, this);
                const transform = d3.zoomTransform (this as SVGSVGElement);
                const originalX = transform.invertX (x);
                const originalY = transform.invertY (y);
                const longitude = xScale.invert (originalX);
                const latitude = yScale.invert (originalY);
                const nearest = data.reduce ((closest, current) => {
            
                    const currentDistance = Math.abs (current.longitude - longitude) + Math.abs (current.latitude - latitude);
                    const closestDistance = Math.abs (closest.longitude - longitude) + Math.abs (closest.latitude - latitude);
                    return currentDistance < closestDistance ? current : closest;
                }, data [0]);
            
                onClickPoint?.({
            
                latitude: nearest.latitude,
                longitude: nearest.longitude,
                meanValue: nearest [valueKey] as number,
                uncertaintyStd: nearest.uncertainty_std,
                });            
            });

        const glyphs = zoomGroup.append ("g")

        glyphs.selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth/2}, ${yScale (d.latitude)})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement)
                drawIsoGlyphs (g, glyphSize, d.uncertainty_std)
                // Alternative farbcodierte Version:
                // drawIsoGlyphsColored (g, glyphSize, d.mean_temperature, d.uncertainty_std)
            })
        return svg.node () as SVGSVGElement;
    })();

    const uncertaintyLegend = (() => {

        const width = 220
        const height = 380

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height)


        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 50 + (uncertaintySteps - 1 - level) * 60

            const g = svg.append ("g")
                .attr ("transform", `translate(50,${y})`)

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0])

            drawIsoGlyphs (g, 28, uncertaintyValue)

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
            .text (config.uncertaintyLabel)

        return svg.node() as SVGSVGElement
    })();

    const isoGlyphPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height)

        const zoomGroup = svg.append("g");

        const zoom = d3.zoom <SVGSVGElement, unknown> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});
            svg.call (zoom);
            svg.on ("click", function (event) {
            
                const [x, y] = d3.pointer (event, this);
                const transform = d3.zoomTransform (this as SVGSVGElement);
                const originalX = transform.invertX (x);
                const originalY = transform.invertY (y);
                const longitude = xScale.invert (originalX);
                const latitude = yScale.invert (originalY);
                const nearest = data.reduce ((closest, current) => {
            
                    const currentDistance = Math.abs (current.longitude - longitude) + Math.abs (current.latitude - latitude);
                    const closestDistance = Math.abs (closest.longitude - longitude) + Math.abs (closest.latitude - latitude);
                    return currentDistance < closestDistance ? current : closest;
                }, data [0]);
            
                onClickPoint?.({
            
                latitude: nearest.latitude,
                longitude: nearest.longitude,
                meanValue: nearest [valueKey] as number,
                uncertaintyStd: nearest.uncertainty_std,
                });            
            });

        const glyphs = zoomGroup.append ("g")

        glyphs.selectAll ("g")
            .data (aggregatedData)
            .join ("g")
            .attr ("transform", d => `translate (${xScale (shiftedLongitude (d.longitude)) + cellWidth / 2}, ${yScale (d.latitude)})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement)
                drawIsoGlyphsColored (g, glyphSize, d [valueKey]!, d.uncertainty_std)
            })

        return svg.node () as SVGSVGElement
    })();

    const isoGlyphLegend = (() => {

        const legendWidth = 240
        const legendHeight = 380
        const topMargin = 15

        const svg = d3.create ("svg")
            .attr ("width", legendWidth)
            .attr ("height", legendHeight)

        const usableHeight = legendHeight - topMargin

        // VALUE LEGEND
        const steps = useDiscrete
            ? valueSteps
            : 100

        const stepHeight = usableHeight / steps


        for (let i = 0; i < steps; i++) {

            const value = i / (steps - 1)

            svg.append ("rect")
                .attr ("x", 20)
                .attr ("y", topMargin + usableHeight - (i + 1) * stepHeight)
                .attr ("width", 25)
                .attr ("height", stepHeight)
                .attr ("fill", d3.interpolateViridis (value))
        }

        const labelSteps = 6


        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1)
            const padding = 0.02
            const t = padding + tRaw * (1 - 2 * padding)
            const y = topMargin + usableHeight - t * usableHeight

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0])

            svg.append ("text")
                .attr ("x", 55)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`);
        }

        // VALUE LABEL
        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            .text (config.valueLabel)

        // UNCERTAINTY GLYPH LEGEND
        for (let level = uncertaintySteps - 1; level >= 0; level--) {

            const y = 55 + (uncertaintySteps - 1 - level) * 60
            const g = svg.append ("g").attr ("transform", `translate(130,${y})`)

            const uncertaintyValue = uncertaintyExtent [0] + (level / (uncertaintySteps - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0])
            const legendMean = (valueExtent [0] + valueExtent [1]) / 2

            drawIsoGlyphsColored (g, 28, legendMean, uncertaintyValue)

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
            .text (config.uncertaintyLabel)

        return svg.node () as SVGSVGElement
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
            a.download = "IsoGlyph_Plots.zip";
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

        case "isoGlyphPlot":
            container.appendChild (isoGlyphPlot);
            break;

        case "isoGlyphLegend":
            container.appendChild (isoGlyphLegend);
            break;

        case "IsoGlyph":
            container.appendChild (isoGlyphPlot);
            container.appendChild (valueLegend);
            break;
        
        case "IsoGlyph+":
            container.appendChild (isoGlyphPlot);
            container.appendChild (isoGlyphLegend);
            break;

        case "all":
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            container.appendChild (isoGlyphPlot);
            container.appendChild (isoGlyphLegend);
            break;

        default:
            container.appendChild(isoGlyphPlot);
            break;
    }
}