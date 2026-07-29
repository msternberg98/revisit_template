import * as d3 from 'd3';
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { createScales, shiftedLongitude, unshiftedLongitude } from "../mapUtils";
import { ClimateData } from "../types";

export interface VSUPOptions {
    preset?: DatasetPreset;
    output?: "valuePlot" | "valueLegend" | "Value" | "uncertaintyPlot" | "uncertaintyLegend" | "Uncertainty" | "vsupPlot" | "vsupLegend" | "Vsup" | "VsupRegions" | "all";
    onClickPoint?: (result: {

        latitude: number;
        longitude: number;
        meanValue: number;
        uncertaintyStd: number;
        sourceValues: ClimateData [];
    }) => void;
}

export async function drawVSUP (container: HTMLDivElement, options: VSUPOptions = {}) {

    const {
        preset = "temperature",
        output = "vsupPlot"
    } = options;

    container.innerHTML = '';

    // Datensatz
    const data = await loadDataset (preset);
    const config = presetInfo [preset];
    const valueKey = config.valueKey;

    const datasetName = config.datasetName;

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
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_Value_Plot.png`;

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

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_Value_Legende.png`;
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
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_Uncertainty_Plot.png`;
    
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

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_Uncertainty_Legende.png`;
        img.width = 150;
        img.height = 380;

        return img;
    })();

    // VSUP Plot
    const vsupPlot = (() => {
    
        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";
    
        // PNG
        const image = document.createElement ("img");
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_VSUP_Plot.png`;
    
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

    // VSUP Legende
    const vsupLegend = (() => {

        const img = document.createElement ("img");

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_VSUP_Legende.png`;
        img.width = 280;
        img.height = 280;

        return img;
    })();

    // VSUP Plot mit Regionen
    const vsupPlotRegions = (() => {
    
        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.overflow = "hidden";

        // PNG
        const image = document.createElement ("img");
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_VSUP_Regions.png`;

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

    // Region Aufgabenstellung
    const regionTask = document.createElement ("div");

    regionTask.innerHTML = `
    <p style="margin-top:0; margin-bottom:0px;">
        Für ein neu entwickeltes Teleskop werden Umgebungstemperaturen von möglichst -12°C bevorzugt. Gleichzeitig sind möglichst verlässliche Temperaturprognosen wünschenswert, da starke Temperaturschwankungen die Funktion der Technik ebenfalls beeinträchtigen können. Die fünf markierten Regionen unterscheiden sich sowohl in ihrer prognostizierten Temperatur als auch in der Unsicherheit dieser Vorhersage.
    </p>
    `;
    
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

        case "vsupPlot":
            container.appendChild (vsupPlot);
            break;

        case "vsupLegend":
            container.appendChild (vsupLegend);
            break;
        
        case "Vsup":
            container.appendChild (vsupPlot);
            container.appendChild (vsupLegend);
            break;

        case "VsupRegions":
            container.appendChild (regionTask);
            container.appendChild (vsupPlotRegions);
            container.appendChild (vsupLegend);
            break;

        case "all":
            container.appendChild (valuePlot);
            container.appendChild (valueLegend);
            container.appendChild (uncertaintyPlot);
            container.appendChild (uncertaintyLegend);
            container.appendChild (vsupPlot);
            container.appendChild (vsupLegend);
            container.appendChild (vsupPlotRegions);
            break;

        default:
            container.appendChild(vsupPlot);
            break;
    }
}