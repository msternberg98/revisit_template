import * as d3 from 'd3';
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { ClimateData } from "../types";

export interface ScaledGlyphOptions {
    preset?: DatasetPreset;
    output?: "scaledGlyphPlot" | "scaledGlyphLegend" | "ScaledGlyph" | "ScaledGlyphRegions" | "all";
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

    // Scaled Glyph Plot
    const scaledGlyphPlot = (() => {
    
        // äußerer Wrapper
        const wrapper = document.createElement ("div");
        wrapper.style.position = "relative";
        
        
        // Normalerweise ursprüngliche Größe,
        // bei zu wenig Platz automatisch verkleinern
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = `${width}px`;
        wrapper.style.aspectRatio = `${width} / ${height}`;

        // Verhindert, dass der Plot vertikal aus dem Fenster läuft.
        // Durch aspectRatio bleibt das Seitenverhältnis erhalten.
        wrapper.style.maxHeight = "65vh";

        wrapper.style.overflow = "hidden";
        wrapper.style.flexShrink = "1";
    
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
            // Internes Koordinatensystem bleibt unverändert
            .attr ("viewBox", `0 0 ${width} ${height}`)
            .attr ("preserveAspectRatio", "xMidYMid meet")

            // Sichtbare Größe richtet sich nach dem Wrapper
            .style ("width", "100%")
            .style ("height", "100%")
            .style ("position", "absolute")
            .style ("left", "0")
            .style ("top", "0")
            .style ("display", "block");
    
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
        // Bisherige Größe als Maximum beibehalten
        img.style.width = "240px";
        img.style.height = "auto";
        img.style.maxWidth = "25%";
        img.style.maxHeight = "65vh";

        // Seitenverhältnis erhalten
        img.style.objectFit = "contain";

        // Darf im Flex-Layout kleiner werden
        img.style.flexShrink = "1";

        img.style.userSelect = "none";
        img.draggable = false;

        return img;
    })();

    // ScaledGlyph Erklärung
    const scaledGlyphExplanation = document.createElement ("div");

    scaledGlyphExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Darstellung B
    </h3>

    <h4> Darstellung </h4>
    <p>
        Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird durch die Größe eines Kreises dargestellt. Dabei wird die Unsicherheit linear auf den Radius des Kreises abgebildet: Der kleinste Unsicherheitswert wird durch den kleinsten Kreis und der größte Unsicherheitswert durch den größten Kreis dargestellt. Auch der kleinste Unsicherheitswert wird als sichtbarer Kreis dargestellt.
    </p>

    <img src = "/Nutzerstudie/Assets/Plots/Annotierter_Pixel_ScaledGlyph.png" alt = "Annotierter_Pixel_VSUP" style = "max-width: 100%; width: 900px;"/>

    <h4> Legende </h4>
    <p>
        Die Legende zeigt, welche Farben den jeweiligen Mittelwerten und welche Kreisgrößen den jeweiligen Unsicherheiten entsprechen. Anhand der Legende können Sie sowohl den dargestellten Mittelwert als auch die zugehörige Unsicherheit ablesen.
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

        case "scaledGlyphPlot":
            container.appendChild (scaledGlyphPlot);
            break;

        case "scaledGlyphLegend":
            container.appendChild (scaledGlyphLegend);
            break;
        
        case "ScaledGlyph":
            // container.appendChild (scaledGlyphExplanation);
            // container.appendChild (scaledGlyphPlot);
            // container.appendChild (scaledGlyphLegend);

            // Erklärung oben
            const layout = document.createElement ("div");

            layout.style.display = "flex";
            layout.style.flexDirection = "column";
            layout.style.alignItems = "center";
            layout.style.gap = "10px";
            layout.style.width = "100%";
            layout.style.maxWidth = "100%";
            layout.style.minWidth = "0";

            layout.appendChild (scaledGlyphExplanation);

            // Plots unter den Text setzen
            const plotLayout = document.createElement ("div");

            plotLayout.style.display = "flex";
            plotLayout.style.flexDirection = "row";
            plotLayout.style.alignItems = "flex-start";
            plotLayout.style.justifyContent = "center";
            plotLayout.style.gap = "0px";

            plotLayout.style.width = "100%";
            plotLayout.style.maxWidth = "100%";
            plotLayout.style.minWidth = "0";

            // Plot nimmt den verbleibenden Platz ein
            scaledGlyphPlot.style.flex = "1 1 auto";
            scaledGlyphPlot.style.minWidth = "0";

            // Legende soll normalerweise 240px breit sein,
            // darf bei Platzmangel aber schrumpfen
            scaledGlyphLegend.style.flex = "0 1 240px";
            scaledGlyphLegend.style.minWidth = "0";

            plotLayout.appendChild (scaledGlyphPlot);
            plotLayout.appendChild (scaledGlyphLegend);

            layout.appendChild (plotLayout);

            // Alles in den Container
            container.appendChild (layout);
            break;

        default:
            container.appendChild(scaledGlyphPlot);
            break;
    }
}