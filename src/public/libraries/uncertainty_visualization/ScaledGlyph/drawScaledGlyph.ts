import * as d3 from 'd3';
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

    const datasetName = config.datasetName;    

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
    
    // Plot Größen
    const width = 1200;
    const cellWidth = 6.35;
    const height = 600;
    const cellHeight = cellWidth;

    // Longitude Shift
    const { xScale, yScale } = createScales (data, width, height);

    const onClickPoint = options.onClickPoint;
    
    // Raster Plot
    function createInteractionLayer (): SVGSVGElement {
    
        const svg = d3.create <SVGSVGElement> ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .style ("position", "absolute")
            .style ("left", "0")
            .style ("top", "0");

        // Alle transparenten Klickfelder
        const rects = svg.selectAll <SVGRectElement, typeof data [number]> ("rect")
            .data (data)
            .join ("rect")
            .attr ("x", d => xScale (shiftedLongitude (d.longitude)))
            .attr ("y", d => yScale (d.latitude) - cellHeight / 2)
            .attr ("width", cellWidth)
            .attr ("height", cellHeight)
            .attr ("fill", "transparent")
            .style ("pointer-events", "all");

        const selectionLayer = svg.append ("g")
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
    const valuePlot = (() => {
    
            // äußerer Wrapper
            const wrapper = document.createElement ("div");
            wrapper.style.position = "relative";
            wrapper.style.width = "100%";
            wrapper.style.maxWidth = `${width}px`;
            wrapper.style.aspectRatio = `${width} / ${height}`;
            wrapper.style.overflow = "hidden";
            wrapper.style.flexShrink = "1";
            wrapper.style.minWidth = "0";
    
            // PNG
            const image = document.createElement ("img");
            image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_Value_Plot.png`;
    
            image.style.position = "absolute";
            image.style.left = "0";
            image.style.top = "0";
            image.style.width = `${width}px`;
            image.style.height = `${height}px`;
            image.style.userSelect = "none";
            image.draggable = false;
            image.style.pointerEvents = "none";
    
            // SVG für Zoom
            const svg = d3.create <SVGSVGElement> ("svg")
                .attr ("viewBox", `0 0 ${width} ${height}`)
                .attr ("preserveAspectRatio", "xMidYMid meet")
                .style ("width", "100%")
                .style ("height", "100%")
                .style ("position", "absolute")
                .style ("left", "0")
                .style ("top", "0");
    
            const contentGroup = svg.append ("g");
    
            // PNG
            const foreignObject = contentGroup.append ("foreignObject")
                .attr ("x", 0)
                .attr ("y", 0)
                .attr ("width", width)
                .attr ("height", height);
    
            foreignObject.node ()!.appendChild (image);
    
            // Interaktionslayer
            const interactionLayer = createInteractionLayer ();
            contentGroup.node ()!.appendChild (interactionLayer);
    
            // Zoom
            const zoom = d3.zoom <SVGSVGElement, undefined> ()
                .extent ([[0, 0], [width, height]])
                .scaleExtent ([1, 20])
                .translateExtent ([[-20, -20], [width + 20, height + 20]])
                .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});
    
            svg.call (zoom);
    
            wrapper.appendChild (svg.node ()!);
    
            return wrapper;
        })();

    // Datensatz Werte Legende
    const valueLegend = (() => {

        const img = document.createElement ("img");

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_Value_Legende.png`;
        img.style.width = "130px";
        img.style.height = "auto";
        img.style.maxWidth = "25%";
        img.style.objectFit = "contain";
        img.style.flexShrink = "1";
        img.style.minWidth = "0";
        img.style.userSelect = "none";
        img.draggable = false;

        return img;
    })();

    // Datensatz Unsicherheit Plot
    const uncertaintyPlot = (() => {
    
            // äußerer Wrapper
            const wrapper = document.createElement ("div");
            wrapper.style.position = "relative";
            wrapper.style.width = "100%";
            wrapper.style.maxWidth = `${width}px`;
            wrapper.style.aspectRatio = `${width} / ${height}`;
            wrapper.style.overflow = "hidden";
            wrapper.style.flexShrink = "1";
            wrapper.style.minWidth = "0";
    
            // PNG
            const image = document.createElement ("img");
            image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_Uncertainty_Plot.png`;
    
            image.style.position = "absolute";
            image.style.left = "0";
            image.style.top = "0";
            image.style.width = `${width}px`;
            image.style.height = `${height}px`;
            image.style.userSelect = "none";
            image.draggable = false;
            image.style.pointerEvents = "none";
    
            // SVG für Zoom
            const svg = d3.create <SVGSVGElement> ("svg")
                .attr ("viewBox", `0 0 ${width} ${height}`)
                .attr ("preserveAspectRatio", "xMidYMid meet")
                .style ("width", "100%")
                .style ("height", "100%")
                .style ("position", "absolute")
                .style ("left", "0")
                .style ("top", "0");
    
            const contentGroup = svg.append ("g");
    
            // PNG
            const foreignObject = contentGroup.append ("foreignObject")
                .attr ("x", 0)
                .attr ("y", 0)
                .attr ("width", width)
                .attr ("height", height);
    
            foreignObject.node ()!.appendChild (image);
    
            // Interaktionslayer
            const interactionLayer = createInteractionLayer ();
            contentGroup.node ()!.appendChild (interactionLayer);
    
            // Zoom
            const zoom = d3.zoom <SVGSVGElement, undefined> ()
                .extent ([[0, 0], [width, height]])
                .scaleExtent ([1, 20])
                .translateExtent ([[-20, -20], [width + 20, height + 20]])
                .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});
    
            svg.call (zoom);
    
            wrapper.appendChild (svg.node ()!);
    
            return wrapper;
        })();

    // Datensatz Unsicherheit Legende
    const uncertaintyLegend = (() => {

        const img = document.createElement ("img");

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_Uncertainty_Legende.png`;
        img.style.width = "220px";
        img.style.height = "auto";
        img.style.maxWidth = "25%";
        img.style.objectFit = "contain";
        img.style.flexShrink = "1";
        img.style.minWidth = "0";

        return img;
    })();

    // Scaled Glyph Plot
    const scaledGlyphPlot = (() => {
    
        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = `${width}px`;
        wrapper.style.aspectRatio = `${width} / ${height}`;
        wrapper.style.overflow = "hidden";
        wrapper.style.flexShrink = "1";
        wrapper.style.minWidth = "0";
    
        // PNG
        const image = document.createElement ("img");
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_ScaledGlyph_Plot.png`;
    
        image.style.position = "absolute";
        image.style.left = "0";
        image.style.top = "0";
        image.style.width = `${width}px`;
        image.style.height = `${height}px`;
        image.style.userSelect = "none";
        image.draggable = false;
        image.style.pointerEvents = "none";
    
        // SVG für Zoom
        const svg = d3.create <SVGSVGElement> ("svg")
            .attr ("viewBox", `0 0 ${width} ${height}`)
            .attr ("preserveAspectRatio", "xMidYMid meet")
            .style ("width", "100%")
            .style ("height", "100%")
            .style ("position", "absolute")
            .style ("left", "0")
            .style ("top", "0");
    
        const contentGroup = svg.append ("g");
    
        // PNG
        const foreignObject = contentGroup.append ("foreignObject")
            .attr ("x", 0)
            .attr ("y", 0)
            .attr ("width", width)
            .attr ("height", height);
    
        foreignObject.node ()!.appendChild (image);
    
        // Interaktionslayer
        const interactionLayer = createInteractionLayer ();
        contentGroup.node ()!.appendChild (interactionLayer);
    
        // Zoom
        const zoom = d3.zoom <SVGSVGElement, undefined> ()
            .extent ([[0, 0], [width, height]])
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});
    
        svg.call (zoom);
    
        wrapper.appendChild (svg.node ()!);
    
        return wrapper;
    })();

    // Scaled Glyph Legende
    const scaledGlyphLegend = (() => {

        const img = document.createElement ("img");

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_ScaledGlyph_Legende.png`;
        img.style.width = "240px";
        img.style.height = "auto";
        img.style.maxWidth = "25%";
        img.style.objectFit = "contain";
        img.style.flexShrink = "1";
        img.style.minWidth = "0";

        return img;
    })();

    // Scaled Glyph Plot mit Regionen
    const scaledGlyphPlotRegions = (() => {

        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = `${width}px`;
        wrapper.style.aspectRatio = `${width} / ${height}`;
        wrapper.style.overflow = "hidden";
        wrapper.style.flexShrink = "1";
        wrapper.style.minWidth = "0";

        // PNG
        const image = document.createElement ("img");
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/ScaledGlyph/${datasetName}_ScaledGlyph_Regions.png`;

        image.style.position = "absolute";
        image.style.left = "0";
        image.style.top = "0";
        image.style.width = `${width}px`;
        image.style.height = `${height}px`;
        image.style.userSelect = "none";
        image.draggable = false;
        image.style.pointerEvents = "none";

        // SVG für Zoom
        const svg = d3.create <SVGSVGElement> ("svg")
            .attr ("viewBox", `0 0 ${width} ${height}`)
            .attr ("preserveAspectRatio", "xMidYMid meet")
            .style ("width", "100%")
            .style ("height", "100%")
            .style ("position", "absolute")
            .style ("left", "0")
            .style ("top", "0");

        const contentGroup = svg.append ("g");

        // PNG
        const foreignObject = contentGroup.append ("foreignObject")
            .attr ("x", 0)
            .attr ("y", 0)
            .attr ("width", width)
            .attr ("height", height);

        foreignObject.node ()!.appendChild (image);

        // Interaktionslayer
        const interactionLayer = createInteractionLayer ();
        contentGroup.node ()!.appendChild (interactionLayer);

        // Zoom
        const zoom = d3.zoom <SVGSVGElement, undefined> ()
            .extent ([[0, 0], [width, height]])
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});

        svg.call (zoom);

        wrapper.appendChild (svg.node()!);

        return wrapper;
    })();

    // Region Aufgabenstellung
    const regionTask = document.createElement ("div");

    regionTask.innerHTML = `
    <p style="margin-top:0; margin-bottom:0px;">
        Für ein neu entwickeltes Teleskop werden Umgebungstemperaturen von möglichst -12°C bevorzugt. Gleichzeitig sind möglichst verlässliche Temperaturprognosen wünschenswert, da starke Temperaturschwankungen die Funktion der Technik ebenfalls beeinträchtigen können. Die fünf markierten Regionen unterscheiden sich sowohl in ihrer prognostizierten Temperatur als auch in der Unsicherheit dieser Vorhersage.
    </p>
    `;
    
    // Container Switch
    switch (output) {

        case "valuePlot": {
            container.appendChild (valuePlot);
            break;
        }

        case "valueLegend": {
            container.appendChild (valueLegend);
            break;
        }

        case "Value": {
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            break;
        }

        case "uncertaintyPlot": {
            container.appendChild (uncertaintyPlot);
            break;
        }

        case "uncertaintyLegend": {
            container.appendChild (uncertaintyLegend);
            break;
        }

        case "Uncertainty": {
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            break;
        }

        case "scaledGlyphPlot": {
            container.appendChild (scaledGlyphPlot);
            break
        }

        case "scaledGlyphLegend": {
            container.appendChild (scaledGlyphLegend);
            break;
        }
        
        case "ScaledGlyph": {
            // container.appendChild (scaledGlyphPlot);
            // container.appendChild (scaledGlyphLegend);

            const layout = document.createElement ("div");

            layout.style.display = "flex";
            layout.style.flexDirection = "row";     // Plots nebeneinander, statt untereinander (column)
            layout.style.alignItems = "center";
            layout.style.justifyContent = "center";
            layout.style.gap = "0px";
            layout.style.width = "100%";
            layout.style.maxWidth = "100%";
            layout.style.minWidth = "0";

            // Plot darf verfügbaren Platz nutzen und schrumpfen
            scaledGlyphPlot.style.flex = "1 1 auto";
            scaledGlyphPlot.style.minWidth = "0";

            // Hier die ursprüngliche Breite der Legende einsetzen
            scaledGlyphLegend.style.flex = "0 1 240px";
            scaledGlyphLegend.style.minWidth = "0";

            layout.appendChild (scaledGlyphPlot);
            layout.appendChild (scaledGlyphLegend);

            container.appendChild (layout);
            break;
        }

        case "ScaledGlyphRegions": {
            // container.appendChild (scaledGlyphPlotRegions);
            // container.appendChild (scaledGlyphLegend);

            // const layout = document.createElement ("div");

            // layout.style.display = "flex";
            // layout.style.flexDirection = "row";     // Plots nebeneinander, statt untereinander (column)
            // layout.style.alignItems = "flex-start";
            // layout.style.justifyContent = "center";
            // layout.style.gap = "0px";
            // layout.style.width = "100%";

            // layout.appendChild (scaledGlyphPlotRegions);
            // layout.appendChild (scaledGlyphLegend);

            // container.appendChild (layout);

            const layout = document.createElement ("div");

            layout.style.display = "flex";
            layout.style.flexDirection = "column";
            layout.style.alignItems = "center";
            layout.style.width = "100%";
            layout.style.maxWidth = "100%";
            layout.style.minWidth = "0";
            layout.style.gap = "10px";

            // Erklärung oben
            layout.appendChild (regionTask);

            // Unterer Bereich mit Plot + Legende
            const plotLayout = document.createElement ("div");

            plotLayout.style.display = "flex";
            plotLayout.style.flexDirection = "row";
            plotLayout.style.alignItems = "center";
            plotLayout.style.justifyContent = "center";
            plotLayout.style.gap = "0px";
            plotLayout.style.width = "100%";
            plotLayout.style.maxWidth = "100%";
            plotLayout.style.minWidth = "0";

            scaledGlyphPlotRegions.style.flex = "1 1 auto";
            scaledGlyphPlotRegions.style.minWidth = "0";

            scaledGlyphLegend.style.flex = "0 1 240px";
            scaledGlyphLegend.style.minWidth = "0";

            plotLayout.appendChild (scaledGlyphPlotRegions);
            plotLayout.appendChild (scaledGlyphLegend);

            // Plot-Bereich unter den Text setzen
            layout.appendChild (plotLayout);

            // Alles in den Container
            container.appendChild (layout);

            break;
        }

        case "all": {
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            container.appendChild (scaledGlyphPlot);
            container.appendChild (scaledGlyphLegend);
            container.appendChild (scaledGlyphPlotRegions)
            break;
        }

        default: {
            container.appendChild(scaledGlyphPlot);
            break;
        }
    }
}