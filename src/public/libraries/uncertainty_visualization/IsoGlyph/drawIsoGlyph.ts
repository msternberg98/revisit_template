import * as d3 from 'd3';
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { createScales, shiftedLongitude, unshiftedLongitude } from "../mapUtils";
import { ClimateData } from "../types";

export interface IsoGlyphOptions {
    preset?: DatasetPreset;
    output?: "valuePlot" | "valueLegend" | "Value" | "uncertaintyPlot" | "uncertaintyLegend" | "Uncertainty" | "isoGlyphPlot" | "isoGlyphLegend" | "IsoGlyph" | "IsoGlyph+" | "IsoGlyphRegions" | "all";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawIsoGlyph (container: HTMLDivElement, options: IsoGlyphOptions = {}) {
     
    const {
        preset = "temperature",
        output = "isoGlyphPlot"
    } = options;
    
    container.innerHTML = '';

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    // Datei Namen für Pfad
    // const datasetName = valueKey === "mean_temperature"
    //     ? "Temperature"
    //     : valueKey === "mean_precipitation"
    //     ? "Precipitation"
    //     : valueKey === "mean_air_pressure"
    //     ? "Air_Pressure"
    //     : valueKey;
    // const datasetName = preset === "temperature"
    //     ? "Temperature"
    //     : preset === "precipitation"
    //     ? "Precipitation"
    //     : preset === "air_pressure"
    //     ? "Air_Pressure"
    //     : preset === "test3"
    //     ? "Test"
    //     : preset
    const datasetName = config.datasetName;
    
    // Aggregation nur nötig, falls PNGs mit Aggregation erstellt werden
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

    // Datensatz Werte Plot
    const valuePlot = (() => {

        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";

        // PNG
        const image = document.createElement ("img");
        image.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_Value_Plot.png`;

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
            .attr ("width", width)
            .attr ("height", height)
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

        img.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_Value_Legende.png`;
        img.width = 130;
        img.height = 380;

        return img;
    })();

    // Datensatz Unsicherheit Plot
    const uncertaintyPlot = (() => {

        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";

        // PNG
        const image = document.createElement ("img");
        image.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_Uncertainty_Plot.png`;

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
            .attr ("width", width)
            .attr ("height", height)
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

        img.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_Uncertainty_Legende.png`;
        img.width = 220;
        img.height = 380;

        return img;
    })();

    // Iso Glyph Plot
    const isoGlyphPlot = (() => {

        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";

        // PNG
        const image = document.createElement ("img");
        image.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_IsoGlyph_Plot.png`;

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
            .attr ("width", width)
            .attr ("height", height)
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
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});

        svg.call (zoom);

        wrapper.appendChild (svg.node ()!);

        return wrapper;
    })();

    // Iso Glyph Legende
   const isoGlyphLegend = (() => {

        const img = document.createElement ("img");

        img.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_IsoGlyph_Legende.png`;
        img.width = 240;
        img.height = 380;

        return img;
    })();

    // Iso Glyph Plot mit Regionen
    const isoGlyphPlotRegions = (() => {

        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";

        // PNG
        const image = document.createElement ("img");
        image.src = `/Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_IsoGlyph_Regions.png`;

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
            .attr ("width", width)
            .attr ("height", height)
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
            .scaleExtent ([1, 20])
            .translateExtent ([[-20, -20], [width + 20, height + 20]])
            .on ("zoom", (event) => {contentGroup.attr ("transform", event.transform);});

        svg.call (zoom);

        wrapper.appendChild (svg.node()!);

        return wrapper;
    })();

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
            container.appendChild (valueLegend);
            break;
        }
        
        case "IsoGlyph+": {
            container.appendChild (isoGlyphPlot);
            container.appendChild (isoGlyphLegend);
            break;
        }

        case "IsoGlyphRegions": {
            container.appendChild (isoGlyphPlotRegions);
            container.appendChild (valueLegend);
            break;
        }

        case "all": {
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            container.appendChild (isoGlyphPlot);
            container.appendChild (isoGlyphLegend);
            container.appendChild (isoGlyphPlotRegions);
            break;
        }

        default: {
            container.appendChild(isoGlyphPlot);
            break;
        }
    }
}