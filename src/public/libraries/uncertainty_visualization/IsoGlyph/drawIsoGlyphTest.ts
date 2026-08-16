import * as d3 from 'd3';
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

    const datasetName = config.datasetName;    
    
    // Plot Größen
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
            .attr ("x", d => xMap.get (d.longitude)!)
            .attr ("y", d => yMap.get (d.latitude)!)
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
        })
        return svg.node () as SVGSVGElement;
    }

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
        image.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_IsoGlyph_Plot.png`;

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

        img.src = `${import.meta.env.BASE_URL}Nutzerstudie/Assets/Plots/${datasetName}/IsoGlyph/${datasetName}_IsoGlyph_Legende.png`;
        img.width = 240;
        img.height = 380;

        return img;
    })();

    // IsoGlyph Erklärung
    const isoGlyphExplanation = document.createElement ("div");

    isoGlyphExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Mehrteilige Farbdarstellung
    </h3>

    <h4> Darstellung </h4>
    <p>
        Bei dieser Visualisierung wird jeder Datenpunkt durch drei farbige Bereiche dargestellt: Der innere Kreis zeigt den Mittelwert minus Standardabweichung. Der Ring darum zeigt den Mittelwert. Der äußere Bereich zeigt den Mittelwert plus Standardabweichung. Bei geringer Unsicherheit liegen die drei Werte nah beieinander und die Bereiche haben ähnliche Farben. Bei hoher Unsicherheit unterscheiden sich die Farben der drei Bereiche stärker voneinander.
    </p>

    <h4> Legende </h4>
    <p>
        Die Legende zeigt, welche Farben den jeweiligen Werten entsprechen. So können Sie die Werte der drei Bereiche anhand ihrer Farben ablesen.
    </p>

    <p>
        Nachdem Sie die Erklärung gelesen und sich mit der Visualisierung vertraut gemacht haben, beantworten Sie bitte die untenstehende Frage.
    </p>

    <p style="margin-bottom:40px;">
        Diese Erklärung kann während der Studie jederzeit über <strong> Hilfe </strong> erneut aufgerufen werden.
    </p>
    `;

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
            // container.appendChild (isoGlyphExplanation);
            // container.appendChild (isoGlyphPlot);
            // container.appendChild (isoGlyphLegend);

            // Erklärung oben
            const layout = document.createElement ("div");

            layout.style.display = "flex";
            layout.style.flexDirection = "column";
            layout.style.alignItems = "center";
            layout.style.gap = "10px";
            layout.style.width = "100%";

            layout.appendChild (isoGlyphExplanation);

            // Plots unter den Text setzen
            const plotLayout = document.createElement ("div");

            plotLayout.style.display = "flex";
            plotLayout.style.flexDirection = "row";
            plotLayout.style.alignItems = "flex-start";
            plotLayout.style.justifyContent = "center";
            plotLayout.style.gap = "0px";
            plotLayout.style.width = "100%";

            plotLayout.appendChild (isoGlyphPlot);
            plotLayout.appendChild (isoGlyphLegend);

            layout.appendChild (plotLayout);

            // Alles in den Container
            container.appendChild (layout);
            break;
        }

        default: {
            container.appendChild (isoGlyphPlot);
            break;
        }
    }
}