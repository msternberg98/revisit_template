import * as d3 from 'd3';
import JSZip from "jszip";
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { ClimateData } from "../types";

export interface ScaledGlyphOptions {
    preset?: DatasetPreset;
    output?: "scaledGlyphPlot" | "scaledGlyphLegend" | "ScaledGlyph";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawScaledGlyphTest (container: HTMLDivElement, options: ScaledGlyphOptions = {}) {
    
    const {
        preset = "temperature",
        output = "scaledGlyphPlot"
    } = options;
    
    container.innerHTML = '';

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    let valueExtent = d3.extent(data, d => d[valueKey]) as [number, number];
    if (valueExtent [0] === valueExtent [1]) {
        valueExtent = [valueExtent [0] - 17, valueExtent [1] + 3];
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

    // Skalierte Glyphen
    function drawScaledGlyphs (g: d3.Selection <SVGGElement, any, any, any>, uncertainty: number) {

        const uncertaintyFactor = (uncertainty - uncertaintyExtent [0]) / (uncertaintyExtent [1] - uncertaintyExtent [0])

        const minRadius = glyphSize * 0.1
        const maxRadius = glyphSize * 0.5
        const radius = minRadius + uncertaintyFactor * (maxRadius - minRadius)

        g.append ("circle")
            .attr ("r", radius)
            .attr ("fill", "none")
            .attr ("stroke", "black")
            .attr ("stroke-width", 1)
    }

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
            .attr ("x", d => xMap.get (d.longitude)!)
            .attr ("y", d => yMap.get (d.latitude)!)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", d => valueColorScale (d [valueKey]!))
            .attr ("shape-rendering", "crispEdges");

        // Glyphen darüber
        const glyphGroup = zoomGroup.append ("g")
            .selectAll ("g")
            .data (data)
            .join ("g")
            .attr ("transform", d => `translate (${xMap.get (d.longitude)! + cellWidth / 2},${yMap.get (d.latitude)! + cellHeight / 2})`)
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
                .attr ("x", xMap.get (d.longitude)!)
                .attr ("y", yMap.get (d.latitude)!)
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
        const steps = 100;
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
                .attr ("font-size", 11)
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`);
        }

        // Werte Label
        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
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
                .attr ("font-size", 11)
                .text (`${(uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)} ${config.unit}`);
        }

        svg.append ("text")
            .attr ("x", 145)
            .attr ("y", 10)
            .attr ("text-anchor", "middle")
            .attr ("font-size", 12)
            .text (config.uncertaintyLabel);

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

        case "scaledGlyphPlot":
            container.appendChild (scaledGlyphPlot);
            break;

        case "scaledGlyphLegend":
            container.appendChild (scaledGlyphLegend);
            break;
        
        case "ScaledGlyph":
            container.appendChild (scaledGlyphPlot);
            container.appendChild (scaledGlyphLegend);
            
            container.appendChild (createExportAllPlots (
                    [
                        [`${datasetName}_ScaledGlyph_Plot`, scaledGlyphPlot, width, height],
                        [`${datasetName}_ScaledGlyph_Legende`, scaledGlyphLegend, 240, 380],
                    ],
                )
            );

            break;

        default:
            container.appendChild(scaledGlyphPlot);
            break;
    }
}