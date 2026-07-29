import * as d3 from 'd3';
import JSZip from "jszip";
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { ClimateData } from "../types";

export interface IsoGlyphOptions {
    preset?: DatasetPreset;
    output?: "isoGlyphPlot" | "isoGlyphLegend" | "IsoGlyph";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawIsoGlyphTest (container: HTMLDivElement, options: IsoGlyphOptions = {}) {
     
    const {
        preset = "temperature",
        output = "isoGlyphPlot"
    } = options;
    
    container.innerHTML = '';

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    let valueExtent = d3.extent(data, d => d[valueKey]) as [number, number];
    if (valueExtent [0] === valueExtent [1]) {
        valueExtent = [valueExtent [0] - 10, valueExtent [1] + 10];
    }
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];
    
    // Diskrete Schritte
    const valueSteps = 8;
    const uncertaintySteps = 6;

    // Farbskala
    const valueColorScale = d3.scaleSequential <string> ()
            .domain (valueExtent)
            .interpolator (d3.interpolateViridis);
    
    // Größen
    const width = 600;
    const height = 600;

    const longitudes = Array.from (new Set (data.map (d => d.longitude))).sort ((a, b) => a - b);
    const latitudes = Array.from (new Set (data.map (d => d.latitude))).sort ((a, b) => a - b);

    const cols = longitudes.length;
    const rows = latitudes.length;

    const cellWidth = width / cols;
    const cellHeight = height / rows;

    const glyphSize = cellWidth

    const xMap = new Map (longitudes.map ((lon, i) => [lon, i * cellWidth]));
    const yMap = new Map (latitudes.map ((lat, i) => [lat, i * cellHeight]));

    const onClickPoint = options.onClickPoint;

    // Iso Glyphen Farbe
    function drawIsoGlyphsColored (g: d3.Selection <SVGGElement, any, any, any>, size: number, value: number, uncertainty: number) {

        const upperValue = Math.min (valueExtent [1], value + uncertainty)
        const lowerValue = Math.max (valueExtent [0], value - uncertainty)

        const outerRingColor = valueColorScale (value)
        const squareColor = valueColorScale (upperValue)
        const innerRingColor = valueColorScale (lowerValue)

        // Quadrat (Wer + Unsicherehit)
        g.append ("rect")
            .attr ("x", -size / 2)
            .attr ("y", -size / 2)
            .attr ("width", size)
            .attr ("height", size)
            .attr ("fill", squareColor)
            .attr ("shape-rendering", "crispEdges");

        // Außenkreis (Wert)
        g.append ("circle")
            .attr ("r", size * 0.4)
            .attr ("fill", outerRingColor)

        // Innenkreis (Wert - Unsicherheit)
        g.append ("circle")
            .attr ("r", size * 0.2)
            .attr ("fill", innerRingColor)
    }

    // Iso Glyph Plot
    const isoGlyphPlot = (() => {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height)

        const zoomGroup = svg.append ("g");
        const zoom = d3.zoom <SVGSVGElement, undefined> ()
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {zoomGroup.attr ("transform", event.transform);});

        svg.call (zoom);

        const glyphs = zoomGroup.append ("g")

        const glyphGroup = glyphs.selectAll ("g")
            .data (data)
            .join ("g")
            .attr ("transform", d => `translate (${xMap.get (d.longitude)! + cellWidth / 2},${yMap.get (d.latitude)! + cellHeight / 2})`)
            .each (function (d) {
                const g = d3.select (this as SVGGElement)
                drawIsoGlyphsColored (g, glyphSize, d [valueKey]!, d.uncertainty_std)
            })
        
        const glyphSelectionLayer = zoomGroup.append("g")
            .attr ("class", "glyph-selection-layer");

        glyphGroup.on ("click", function (event, d) {

            event.stopPropagation ();
            glyphSelectionLayer.selectAll ("*").remove ();
            glyphSelectionLayer.append ("rect")
                .attr ("class", "selection-marker")
                .attr ("x", xMap.get (d.longitude)!)
                .attr ("y", yMap.get (d.latitude)!)
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
        });
        return svg.node () as SVGSVGElement
    })();

    // Iso Glyph Legende
    const isoGlyphLegend = (() => {

        const legendWidth = 240
        const legendHeight = 380
        const topMargin = 15

        const svg = d3.create ("svg")
            .attr ("width", legendWidth)
            .attr ("height", legendHeight)

        const usableHeight = legendHeight - topMargin

        // Wert Legende
        const steps = 100
        const stepHeight = usableHeight / steps
        const labelSteps = 6


        for (let i = 0; i < steps; i++) {

            const value = i / (steps - 1)

            svg.append ("rect")
                .attr ("x", 20)
                .attr ("y", topMargin + usableHeight - (i + 1) * stepHeight)
                .attr ("width", 25)
                .attr ("height", stepHeight)
                .attr ("fill", d3.interpolateViridis (value))
                .attr ("shape-rendering", "crispEdges");
        }

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

        // Werte Label
        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            .text (config.valueLabel)

        // Iso Glyphen
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
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext ("2d");

        if (!ctx) {throw new Error ("Canvas Context konnte nicht erzeugt werden.");}

        ctx.imageSmoothingEnabled = false;
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
            a.download = `${datasetName}_IsoGlyph_Plots.zip`;
            a.click ();

            URL.revokeObjectURL (url);
        };
        return button;
    }

    // Container Switch
    switch (output) {

        case "isoGlyphPlot": {
            container.appendChild (isoGlyphPlot);
            break;
        }

        case "isoGlyphLegend": {
            container.appendChild (isoGlyphLegend);
            break;
        }

        case "IsoGlyph": {
            container.appendChild (isoGlyphPlot);
            container.appendChild (isoGlyphLegend);

            container.appendChild (createExportAllPlots (
                    [
                        [`${datasetName}_IsoGlyph_Plot`, isoGlyphPlot, width, height],
                        [`${datasetName}_IsoGlyph_Legende`, isoGlyphLegend, 240, 380],
                    ],
                )
            );

            break;
        }

        default: {
            container.appendChild(isoGlyphPlot);
            break;
        }
    }
}