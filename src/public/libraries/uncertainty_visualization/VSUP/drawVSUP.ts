import * as d3 from 'd3';
import * as JSZip from "jszip";
import { loadDataset } from "../dataLoader";
import { presetInfo } from "../presetInfo";

type VSUPPreset = 'precipitation' | 'temperature' | 'air_pressure';

export async function drawVSUP (container: HTMLDivElement, preset: VSUPPreset = 'precipitation') {

    container.innerHTML = '';

    // ----------------------------
    // DATA LOADING (REVISIT-COMPATIBEL)
    // ----------------------------

    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    // ----------------------------
    // EXTENTS (statt Observable workbook.sheet)
    // ----------------------------

    const valueExtent = d3.extent (data, d => d [valueKey]) as [number, number];
    const uncertaintyExtent = d3.extent (data, (d: any) => d.uncertainty_std,) as [number, number];

    // ----------------------------
    // CONFIG
    // ----------------------------

    const valueSteps = 8;
    const uncertaintySteps = 6;
    const useDiscrete = false;

    // ----------------------------
    // COLOR SCALE
    // ----------------------------

    const valueColorScale = useDiscrete
        ? d3.scaleQuantize <string> ()
            .domain (valueExtent)
            .range (d3.range (valueSteps).map ((i) => d3.interpolateViridis (i / (valueSteps - 1)),),)
        : d3.scaleSequential <string> ()
            .domain (valueExtent)
            .interpolator (d3.interpolateViridis);

    // ----------------------------
    // UNCERTAINTY SCALE
    // ----------------------------

    const uncertaintyScale = useDiscrete
        ? d3.scaleQuantize <number> ()
            .domain (uncertaintyExtent)
            .range (d3.range(uncertaintySteps))
        : d3.scaleLinear ()
            .domain (uncertaintyExtent)
            .range ([0, uncertaintySteps - 1]);

    function vsupColor (value: number, uncertainty: number): string {
        const uncertaintyLevel = uncertaintyScale (uncertainty);

        // Anzahl verfügbarer Werte
        const availableBins = Math.max (2, valueSteps - Math.round (uncertaintyLevel));

        // maximal unsicher
        if (availableBins <= 1) {
            return "#d9d9d9";
        }

        // Wert normalisieren
        const normalized = (value - valueExtent[0]) / (valueExtent[1] - valueExtent[0]);

        // auf reduzierte Bins quantisieren
        const quantized = useDiscrete
            ? Math.floor (normalized * availableBins) / (availableBins - 1)
            : normalized;

        // Basisfarbe
        const base = d3.interpolateViridis (quantized);

        // zusätzliche uncertainty suppression
        const blend = uncertaintyLevel / (uncertaintySteps - 1);

        return d3.interpolateRgb (base, "#d9d9d9")(blend * 0.7);
    }

    const width = 1200;
    const cellWidth = 8;
    const height = 600;
    const cellHeight = 8;

    function shiftedLongitude (lon: number): number {
        let shifted = lon - 30;

        if (shifted > 180) {
            shifted -= 360;
        }

        return shifted;
    }

    const xScale = d3.scaleLinear ()
        .domain (d3.extent (data, (d) => shiftedLongitude (d.longitude)) as [number, number])
        .range ([0, width]);

    const yScale = d3.scaleLinear ()
        .domain (d3.extent (data, (d) => d.latitude) as [number, number])
        .range ([height, 0]);

    function createRasterPlot (colorFunction: (d: typeof data[number]) => string): SVGSVGElement {

        const svg = d3.create ("svg")
            .attr ("width", width)
            .attr ("height", height);

        svg.selectAll ("rect")
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

            const scaleValue = valueExtent [0] + value * (valueExtent [1] - valueExtent [0]);

            // Niederschlag pro Sekunde → mm/Tag
            // const scaleValue = valueExtent [0] * 86400 + value * (valueExtent [1] * 86400 - valueExtent [0] * 86400);

            // svg.append ("text")
            //   .attr ("x", 60)
            //   .attr ("y", topMargin + usableHeight - i * stepHeight - 8)
            //   .attr ("font-size", 11)
            //   .text (scaleValue.toFixed(1));

            // if (i % Math.round(steps / labelSteps) === 0 || i === steps - 1) {
            //   svg.append ("text")
            //     .attr ("x", 60)
            //     .attr ("y", topMargin + usableHeight - i * stepHeight - 15)
            //     .attr ("font-size", 11)
            //     .text(scaleValue.toFixed (1));
            // }
        }

        const labelSteps = 6;

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);

            const scaleValue = valueExtent [0] + tRaw * (valueExtent [1] - valueExtent [0]);

            // Niederschlag pro Sekunde → mm/Tag
            // const scaleValue = valueExtent [0] * 86400 + tRaw * (valueExtent [1] * 86400 - valueExtent [0] * 86400);

            const y = topMargin + usableHeight - t * usableHeight;

            svg.append ("text")
                .attr ("x", 60)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                // .text (scaleValue.toFixed (1))
                .text (`${(scaleValue * config.factor).toFixed (config.decimals)} ${config.unit}`)
        }

        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            //.text ("Mittelwert");
            .text (config.valueLabel)

        return svg.node () as SVGSVGElement;
    })();

    const uncertaintyPlot = createRasterPlot ((d) => {
        const level = uncertaintyScale (d.uncertainty_std);
        return d3.interpolateGreys (level / (uncertaintySteps - 1));
    });

    const uncertaintyLegend = (() => {

        const legendWidth = 150;
        const legendHeight = 380;
        const topMargin = 15;

        const steps = useDiscrete
            ? uncertaintySteps
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
            .attr ("fill", d3.interpolateGreys(value));

            const scaleValue = uncertaintyExtent [0] + value * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            // Niederschlag pro Sekunde → mm/Tag
            // const scaleValue = uncertaintyExtent[0] * 86400 + value * (uncertaintyExtent[1] * 86400 - uncertaintyExtent[0] * 86400);
        }

        const labelSteps = 6;

        for (let j = 0; j < labelSteps; j++) {

            const tRaw = j / (labelSteps - 1);
            const padding = 0.02;
            const t = padding + tRaw * (1 - 2 * padding);

            const uncertaintyValue = uncertaintyExtent [0] + tRaw * (uncertaintyExtent[1] - uncertaintyExtent [0]);

            // Niederschlag pro Sekunde → mm/Tag
            // const uncertaintyValue = uncertaintyExtent[0] * 86400 + tRaw * (uncertaintyExtent[1] * 86400 - uncertaintyExtent[0] * 86400);

            const y = topMargin + usableHeight - t * usableHeight;

            svg.append ("text")
                .attr ("x", 60)
                .attr ("y", y + 4)
                .attr ("font-size", 11)
                //Temperatur
                //.text(uncertaintyValue.toFixed(2))
                //Niederschlag
                //.text ((uncertaintyValue * config.factor).toFixed (2))
                //Luftdruck
                //.text((uncertaintyValue / 100).toFixed(0));
                .text (`${(uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)} ${config.unit}`)
        }

        svg.append ("text")
            .attr ("x", 20)
            .attr ("y", 10)
            .attr ("font-size", 12)
            //.text ("Standardabweichung");
            .text (config.uncertaintyLabel)

        return svg.node () as SVGSVGElement;

        })();

    const vsupPlot = createRasterPlot (d => vsupColor (d [valueKey]!, d.uncertainty_std));

    const vsupLegend = (() => {

        const size = 280;
        const margin = 50;

        const centerX = margin;
        const centerY = size - margin;
        const maxRadius = 150;

        const svg = d3.create ("svg")
            .attr ("width", size)
            .attr ("height", size);

        const rings = useDiscrete
            ? [1, 2, 4, 6, 8]
            : d3.range (60);

        if (useDiscrete) {

            rings.forEach ((bins, ringIndex) => {

                const innerRadius = ringIndex * (maxRadius / rings.length);
                const outerRadius = (ringIndex + 1) * (maxRadius / rings.length);

                for (let i = 0; i < bins; i++) {

                    const arc = d3.arc ()
                        .innerRadius (innerRadius)
                        .outerRadius (outerRadius)
                        .startAngle ((i / bins) * Math.PI * 0.5)
                        .endAngle (((i + 1) / bins) * Math.PI * 0.5);

                    const value = i / Math.max (1, bins - 1);

                    const base = bins === 1
                        ? "#d9d9d9"
                        : d3.interpolateViridis (value);

                    const blend = 1 - ringIndex / (rings.length - 1);
                    const color = d3.interpolateRgb (base, "#d9d9d9")(blend * 0.7);

                    const arcGenerator = d3.arc ();

                    svg.append ("path")
                        .attr ("transform", `translate(${centerX},${centerY})`)
                        .attr ("d", arcGenerator({
                            innerRadius,
                            outerRadius,
                            startAngle: (i / bins) * Math.PI * 0.5,
                            endAngle: ((i + 1) / bins) * Math.PI * 0.5}))
                        .attr ("fill", color)
                        .attr ("stroke", "white")
                        .attr ("stroke-width", 1);
                }
            });

        } else {

            const ringCount = 40;
            const angleSteps = 1440;

            for (let r = 0; r < ringCount; r++) {

                const innerRadius = r * (maxRadius / ringCount);
                const outerRadius = (r + 1) * (maxRadius / ringCount);

                const uncertaintyBlend = 1 - r / (ringCount - 1);

                for (let a = 0; a < angleSteps; a++) {

                    const startAngle = (a / angleSteps) * Math.PI * 0.5;
                    const endAngle = ((a + 1) / angleSteps) * Math.PI * 0.5;

                    const value = a / (angleSteps - 1);

                    const base = d3.interpolateViridis(value);
                    const color = d3.interpolateRgb (base, "#d9d9d9")(uncertaintyBlend * 0.7 );

                    const arc = d3.arc ()
                        .innerRadius (innerRadius)
                        .outerRadius (outerRadius)
                        .startAngle (startAngle)
                        .endAngle (endAngle);

                    const arcGenerator = d3.arc ();

                    svg.append ("path")
                        .attr ("transform", `translate(${centerX + 6},${centerY})`)
                        .attr ("d", arcGenerator({
                            innerRadius,
                            outerRadius,
                            startAngle: (a / angleSteps) * Math.PI * 0.5,
                            endAngle: ((a + 1) / angleSteps) * Math.PI * 0.5}))
                        .attr ("fill", color)
                        .attr ("stroke", "white")
                        .attr ("stroke-width", 1);
                }
            }
        }


        const uncertaintyAngle = Math.PI / 2;

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

            svg.append ("line")
                .attr ("x1", centerX - 2)
                .attr ("y1", y)
                .attr ("x2", centerX - 10)
                .attr ("y2", y)
                .attr ("stroke", "black");

            const uncertaintyValue = uncertaintyExtent [1] - t * (uncertaintyExtent [1] - uncertaintyExtent [0]);

            svg.append ("text")
                .attr ("x", centerX - 14)
                .attr ("y", y + 4)
                .attr ("font-size", 10)
                .attr ("text-anchor", "end")
                //.text ((uncertaintyValue * config.factor).toFixed(2));
                .text (`${(uncertaintyValue * config.factor).toFixed (config.uncertainty_decimals)} ${config.unit}`)
        }

        svg.append ("text")
            .attr ("transform",`translate(${centerX - 40},${centerY - maxRadius / 2}) rotate(-90)`)
            .attr ("text-anchor", "middle")
            .attr ("font-size", 12)
            //.text ("Standardabweichung");
            .text (config.uncertaintyLabel)

        // Value Scale
        const valueRadius = maxRadius + 10;

        svg.append ("path")
        .attr ("d", d3.arc()({
            innerRadius: valueRadius,
            outerRadius: valueRadius,
            startAngle: 0,
            endAngle: Math.PI / 2}))
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

            const x1 = centerX + 6 + Math.cos (angle) * tickInner;
            const y1 = centerY - Math.sin (angle) * tickInner;
            const x2 = centerX + 6 + Math.cos (angle) * tickOuter;
            const y2 = centerY - Math.sin (angle) * tickOuter;

            svg.append ("line")
                .attr ("x1", x1)
                .attr ("y1", y1)
                .attr ("x2", x2)
                .attr ("y2", y2)
                .attr ("stroke", "black");

            const value = valueExtent [0] + t * (valueExtent [1] - valueExtent [0]);
            const labelRadius = valueRadius + 22;

            const lx = centerX + 6 + Math.cos (angle) * labelRadius;
            const ly = centerY - Math.sin (angle) * labelRadius;

            svg.append("text")
                .attr ("x", lx)
                .attr ("y", ly + 4)
                .attr ("font-size", 10)
                .attr ("text-anchor", "middle")
                //.text ((value * 86400).toFixed (1));
                .text (`${(value * config.factor).toFixed (config.decimals)} ${config.unit}`)
        }

        svg.append ("text")
        .attr ("x", centerX + 85 + maxRadius * 0.55)
        .attr ("y", centerY - maxRadius)
        .attr ("font-size", 12)
        .attr ("text-anchor", "middle")
        //.text ("Mittelwert");
        .text (config.valueLabel)

        return svg.node ();
    })();

    function createExportAllPlots (
        plots: Array<[string, SVGElement]>,
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
            a.download = "VSUP_Plots.zip";
            a.click ();

            URL.revokeObjectURL (url);
        };

        return button;
    }
    container.appendChild(vsupPlot);
}