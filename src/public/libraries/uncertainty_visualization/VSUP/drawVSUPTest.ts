import * as d3 from 'd3';
import { loadDataset, DatasetPreset } from "../dataLoader";
import { presetInfo } from "../presetInfo";
import { ClimateData } from "../types";

export interface VSUPOptions {
    preset?: DatasetPreset;
    output?:  "vsupPlot" | "vsupLegend" | "Vsup";
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
        image.src = `/Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_VSUP_Plot.png`;
    
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

        img.src = `/Nutzerstudie/Assets/Plots/${datasetName}/Vsup/${datasetName}_VSUP_Legende.png`;
        img.width = 280;
        img.height = 280;

        return img;
    })();

    // Aufgaben Erklärung
    const taskExplanation = document.createElement ("div");

    taskExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Aufgabentypen
    </h3>

    <p>
        In dieser Studie wird Ihnen die jeweilige Aufgabenstellung immer auf der linken Seite angezeigt.
        Wenn Sie aufgefordert werden, auf eine bestimmte Stelle im Bild zu klicken, wählen Sie diese einfach mit der linken Maustaste aus. Die von Ihnen ausgewählte Stelle wird anschließend mit einem schwarzen Quadrat markiert. Sie können Ihre Auswahl jederzeit ändern, indem Sie auf eine andere Stelle im Bild klicken. Innerhalb eines Bildes können Sie mit dem Mausrad zoomen und das Bild mithilfe der linken Maustaste verschieben.
        Weitere Fragen oder Eingaben erscheinen unterhalb der jeweiligen Aufgabenstellung auf der linken Seite. 
        Bitte bearbeiten Sie alle Aufgaben vollständig. Nehmen Sie sich für jede Aufgabe ausreichend Zeit und beantworten Sie diese nach bestem Wissen.
    </p>

    <p>
        Vor dem Start der Fragen werden einmal alle Visualisierungsmethoden erklärt und geprüft ob Sie diese richtig verstanden haben. Sollten Sie dabei dreimal falsch liegen, wird die Nutzerumfrage beendet.
        Sobald Sie eine Aufgabe fertig bearbeitet haben, klicken Sie auf <strong> Weiter </strong> am Ende der Seite, um zur nächsten Aufgabe zu gelangen. <br>
        Bei weiteren Fragen wenden Sie sich an den Studienleiter.
    </p>

    <p style="margin-bottom:40px;">
        Diese Erklärung kann während der Studie jederzeit über <strong> Help </strong> erneut aufgerufen werden.
    </p>
    `;

    // VSUP Erklärung
    const vsupExplanation = document.createElement ("div");

    vsupExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Value-Suppressing Uncertainty Palette (VSUP) 
    </h3>

    <p>
        Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird über die Farbsättigung kodiert. Je höher die Unsicherheit eines Datenpunkts ist, desto stärker werden die Farben entsättigt. Dadurch unterscheiden sich die Farben verschiedener Mittelwerte immer weniger. Bei maximaler Unsicherheit erscheinen alle Werte nahezu grau, unabhängig vom tatsächlichen Mittelwert. Dadurch wird signalisiert, dass diese Werte mit größerer Vorsicht interpretiert werden sollten. Bereiche mit geringer Unsicherheit besitzen dagegen kräftige Farben und lassen sich genauer Unterscheiden.
    </p>

    <p style="margin-bottom:40px;">
        Diese Erklärung kann während der Studie jederzeit über <strong> Help </strong> erneut aufgerufen werden.
    </p>
    `;

    // Container Switch
    switch (output) {

        case "vsupPlot":
            container.appendChild (taskExplanation);
            container.appendChild (vsupPlot);
            break;

        case "vsupLegend":
            container.appendChild (vsupLegend);
            break;
        
        case "Vsup":
            container.appendChild (vsupExplanation);
            container.appendChild (vsupPlot);
            container.appendChild (vsupLegend);
            break;

        default:
            container.appendChild(vsupPlot);
            break;
    }
}