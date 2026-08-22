import * as d3 from 'd3';
import JSZip from "jszip";
import { vsupColor } from "./vsupColor";
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { ClimateData } from "../types";

export interface VSUPOptions {
    preset?: DatasetPreset;
    output?: "vsupPlot" | "vsupLegend" | "Vsup";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawVSUPTest (container: HTMLDivElement, options: VSUPOptions = {}) {

    const {
        preset = "temperature",
        output = "vsupPlot"
    } = options;

    container.innerHTML = '';

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    let valueExtent = d3.extent(data, d => d[valueKey]) as [number, number];
    valueExtent = [valueExtent [0] - 4, valueExtent [1] + 6];
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];

    // Diskrete Schritte
    const valueSteps = 8;
    const uncertaintySteps = 6;

    // Unsicherheitsskala
    const uncertaintyScale = d3.scaleLinear ()
            .domain (uncertaintyExtent)
            .range ([0, uncertaintySteps - 1]);

    // Größen
    const width = 600;
    const height = 600;

    const longitudes = Array.from (new Set (data.map (d => d.longitude))).sort ((a, b) => a - b);
    const latitudes = Array.from (new Set (data.map (d => d.latitude))).sort ((a, b) => a - b);

    const cols = longitudes.length;
    const rows = latitudes.length;

    const cellWidth = width / cols;
    const cellHeight = height / rows;

    const xMap = new Map (longitudes.map ((lon, i) => [lon, i * cellWidth]));
    const yMap = new Map (latitudes.map ((lat, i) => [lat, i * cellHeight]));

    const onClickPoint = options.onClickPoint;

    // Raster Plot
    function createRasterPlot (colorFunction: (d: typeof data[number]) => string): SVGSVGElement {

        const svg = d3.create <SVGSVGElement> ("svg")
            .attr ("width", width)
            .attr ("height", height);

        const plotGroup = svg.append ("g");

        const rects = plotGroup
            .selectAll ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", d => xMap.get (d.longitude)!)
            .attr ("y", d => yMap.get (d.latitude)!)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", colorFunction)
            .attr ("shape-rendering", "crispEdges");

        const selectionLayer = plotGroup.append ("g")
            .attr ("class", "selection-layer");

        rects.on ("click", function (event, d) {

            event.stopPropagation ();

            selectionLayer.selectAll ("*").remove ();

            selectionLayer.append ("rect")
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
                meanValue: d[valueKey] as number,
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
    }

    // VSUP Plot
    const vsupPlot = createRasterPlot (d => vsupColor ({
            value: d [valueKey]!,
            uncertainty: d.uncertainty_std,
            valueExtent,
            uncertaintyScale,
            valueSteps,
            uncertaintySteps,
            useDiscrete: false
        })
    );

    // VSUP Legende
    const vsupLegend = (() => {

        const size = 280;
        const margin = 50;

        const centerX = margin;
        const centerY = size - margin;
        const maxRadius = 150;

        const svg = d3.create <SVGSVGElement> ("svg")
            .attr ("width", size)
            .attr ("height", size);

        const arcGenerator = d3.arc ();

        const ringCount = 40;
        const angleSteps = 1440;

        for (let r = 0; r < ringCount; r++) {

            const innerRadius = r * (maxRadius / ringCount);
            const outerRadius = (r + 1) * (maxRadius / ringCount);

            for (let a = 0; a < angleSteps; a++) {

                const startAngle = (a / angleSteps) * Math.PI * 0.5;
                const endAngle = ((a + 1) / angleSteps) * Math.PI * 0.5;

                const value = valueExtent [0] + (a / (angleSteps - 1)) * (valueExtent [1] - valueExtent [0]);
                const uncertainty = uncertaintyExtent [1] - (r / (ringCount - 1)) * (uncertaintyExtent [1] - uncertaintyExtent [0]);

                const color = vsupColor ({
                    value,
                    uncertainty,
                    valueExtent,
                    uncertaintyScale,
                    valueSteps,
                    uncertaintySteps,
                    useDiscrete: false
                });

                svg.append ("path")
                    .attr ("transform", `translate(${centerX + 6},${centerY})`)
                    .attr ("d", arcGenerator ({
                            innerRadius,
                            outerRadius,
                            startAngle,
                            endAngle
                        })
                    )
                    .attr ("fill", color)
                    .attr ("stroke", "white")
                    .attr ("stroke-width", 0);
            }
        }

        // Unsicherheitsachse
        svg.append ("line")
            .attr ("x1", centerX - 2)
            .attr ("y1", centerY)
            .attr ("x2", centerX - 2)
            .attr ("y2", centerY - maxRadius)
            .attr ("stroke", "black")
            .attr ("stroke-width", 1.5);

        const uncertaintyTicks = 5;

        for (let i = 0; i < uncertaintyTicks; i++) {

            const t = i / (uncertaintyTicks - 1);
            const y = centerY - t * maxRadius;

            const uncertaintyValue = uncertaintyExtent [1] - t * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            svg.append ("line")
                .attr ("x1", centerX - 2)
                .attr ("y1", y)
                .attr ("x2", centerX - 10)
                .attr ("y2", y)
                .attr ("stroke", "black");

            svg.append ("text")
                .attr ("x", centerX - 14)
                .attr ("y", y + 4)
                .attr ("font-size", 12)
                .attr ("text-anchor", "end")
                .text ((uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)
                );
        }

        svg.append ("text")
            .attr ("transform", `translate (${centerX - 40},${centerY - maxRadius / 2}) rotate (-90)`)
            .attr ("text-anchor", "middle")
            .attr ("font-size", 16)
            .text (config.uncertaintyLabel);

        // Werteachse
        const valueRadius = maxRadius + 10;

        svg.append ("path")
            .attr ("d", d3.arc ()({
                    innerRadius: valueRadius,
                    outerRadius: valueRadius,
                    startAngle: 0,
                    endAngle: Math.PI / 2
                })
            )
            .attr ("transform", `translate(${centerX + 6},${centerY})`)
            .attr ("fill", "none")
            .attr ("stroke", "black")
            .attr ("stroke-width", 1.5);

        const valueTicks = 5;

        for (let i = 0; i < valueTicks; i++) {

            const t = i / (valueTicks - 1);
            const angle = Math.PI / 2 - t * Math.PI / 2;

            const tickInner = valueRadius;
            const tickOuter = valueRadius + 8;
            const labelRadius = valueRadius + 22;

            const x1 = centerX + 6 + Math.cos (angle) * tickInner;
            const y1 = centerY - Math.sin (angle) * tickInner;

            const x2 = centerX + 6 + Math.cos (angle) * tickOuter;
            const y2 = centerY - Math.sin (angle) * tickOuter;

            const lx = centerX + 6 + Math.cos (angle) * labelRadius;
            const ly = centerY - Math.sin (angle) * labelRadius;

            const value = valueExtent [0] + t * (valueExtent [1] - valueExtent [0]);

            svg.append ("line")
                .attr ("x1", x1)
                .attr ("y1", y1)
                .attr ("x2", x2)
                .attr ("y2", y2)
                .attr ("stroke", "black");

            svg.append ("text")
                .attr ("x", lx)
                .attr ("y", ly + 4)
                .attr ("font-size", 12)
                .attr ("text-anchor", "middle")
                .text ((value * config.factor).toFixed (config.decimals));
        }

        svg.append ("text")
            .attr ("x", centerX + 85 + maxRadius * 0.55)
            .attr ("y", centerY - maxRadius)
            .attr ("font-size", 16)
            .attr ("text-anchor", "middle")
            .text (config.valueLabel);

        return svg.node ()!;
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
            a.download = `${datasetName}_VSUPTest_Plots.zip`;
            a.click ();

            URL.revokeObjectURL (url);
        };
        return button;
    }

    // Container Switch
    switch (output) {

        case "vsupPlot":
            container.appendChild (vsupPlot);
            break;

        case "vsupLegend":
            container.appendChild (vsupLegend);
            break;
        
        case "Vsup":
            container.appendChild (vsupPlot);
            container.appendChild (vsupLegend);
            
            container.appendChild (createExportAllPlots (
                    [
                        [`${datasetName}_VSUPTest_Plot`, vsupPlot, width, height],
                        [`${datasetName}_VSUPTest_Legende`, vsupLegend, 280, 280],
                    ],
                )
            );

            break;

        default:
            container.appendChild(vsupPlot);
            break;
    }
}