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

    // Aufgaben Erklärung
    const taskExplanation = document.createElement ("div");

    taskExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Aufgabentypen
    </h3>

    <h4> Aufbau </h4>
    <p>
        Die jeweilige Aufgabenstellung wird Ihnen während der Studie immer auf der linken Seite angezeigt.
        Weitere Fragen oder Eingabefelder erscheinen unterhalb der Aufgabenstellung.
    </p>

    <h4> Beantwortung der Aufgaben </h4>
    <p>
        Je nach Aufgabe stehen Ihnen unterschiedliche Möglichkeiten zur Beantwortung zur Verfügung:
    </p>

    <ul>
        <li>
            <strong> Auswahl: </strong> Bei einigen Fragen wählen Sie eine der vorgegebenen Antwortmöglichkeiten aus.
        </li>
        <li>
            <strong> Texteingabe: </strong> Bei Fragen mit einem Eingabefeld geben Sie Ihre Antwort über die Tastatur ein. Je nach Frage steht hierfür ein kurzes oder ein größeres Textfeld zur Verfügung.
        </li>
        <li>
            <strong> Auswahlliste: </strong> Bei einigen Fragen wählen Sie eine Antwort aus einer aufklappbaren Liste aus.
        </li>
        <li>
            <strong> Bewertungsskala: </strong> Bei Bewertungsfragen wählen Sie den Punkt auf der Skala aus, der Ihrer Einschätzung am besten entspricht.
        </li>
        <li>
            <strong> Rangfolge: </strong> Bei Fragen zur Rangfolge ziehen Sie die verfügbaren Antworten mit gedrückter linker Maustaste in den dafür vorgesehenen Bereich und ordnen sie dort entsprechend der angegebenen Reihenfolge an.
        </li>
    </ul>

    <h4> Interaktion mit den Visualisierungen </h4>
    <p>
        Wenn Sie aufgefordert werden, eine bestimmte Stelle in der Visualisierung auszuwählen,
        klicken Sie diese mit der linken Maustaste an. Die ausgewählte Stelle wird anschließend
        mit einem pinken Quadrat markiert. Sie können Ihre Auswahl jederzeit ändern, indem Sie
        auf eine andere Stelle in der Visualisierung klicken.
    </p>
    <p>
        Innerhalb einer Visualisierung können Sie mit dem Mausrad zoomen.
        Zum Verschieben halten Sie die linke Maustaste gedrückt und bewegen die Maus.
    </p>

    <h4> Ablauf </h4>
    <p>
        Bevor Sie mit den eigentlichen Aufgaben beginnen, werden Ihnen zunächst alle
        Visualisierungsmethoden erklärt. Anschließend wird überprüft, ob Sie die Methoden
        richtig verstanden haben. Sollten Sie dabei dreimal eine falsche Antwort geben,
        wird die Studie beendet.
    </p>

    <p>
        Sobald Sie eine Aufgabe vollständig bearbeitet haben, klicken Sie am Ende der Seite
        auf <strong>Weiter</strong>, um zur nächsten Aufgabe zu gelangen.
        Bitte bearbeiten Sie alle Aufgaben vollständig. Antworten Sie zügig, aber so genau wie möglich.
    </p>

    <h4> Hinweise </h4>
    <p>
        Auf dieser Seite sehen Sie Beispiele für die verschiedenen Aufgabentypen.
        Sollte nach einem Mausklick auf die unten dargestellte Visualisierung kein pinkes Quadrat
        erscheinen, unterstützt Ihr Browser diese Interaktion möglicherweise nicht.
        Wechseln Sie in diesem Fall zu einem anderen Browser.
    </p>

    <p>
        Getestete Browser: Microsoft Edge, Google Chrome und Mozilla Firefox
    </p>

    <p style="margin-bottom:40px;">
        Bei weiteren Fragen oder Problemen wenden Sie sich bitte an den Studienleiter: maurice.sternberg@student.uni-siegen.de <br><br>
        Diese Erklärung kann während der Studie jederzeit über <strong> Hilfe </strong> erneut aufgerufen werden.
    </p>
    `;

    // VSUP Erklärung
    const vsupExplanation = document.createElement ("div");

    vsupExplanation.innerHTML = `
    <h3 style="font-size:36px; margin-top:0; margin-bottom:0px;">
        Farbdarstellung mit Entsättigung 
    </h3>

    <h4> Darstellung </h4>
    <p>
        Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird über die Farbsättigung dargestellt. Je höher die Unsicherheit eines Datenpunkts ist, desto stärker wird die Farbe entsättigt. Dadurch werden die Farbunterschiede zwischen verschiedenen Mittelwerten mit zunehmender Unsicherheit geringer. Beim größten Unsicherheitswert werden die Farben am stärksten mit Grau vermischt. Bereiche mit geringer Unsicherheit werden dagegen mit kräftigeren Farben dargestellt.
    </p>

    <img src = "/Nutzerstudie/Assets/Plots/Annotierter_Pixel_VSUP.png" alt = "Annotierter_Pixel_VSUP" style = "max-width: 100%; width: 900px;"/>

    <h4> Legende </h4>
    <p>
        Die Legende zeigt, welche Kombinationen aus Mittelwert und Unsicherheit den jeweiligen
        Farben entsprechen. Anhand der Legende können Sie sowohl den dargestellten Mittelwert
        als auch die zugehörige Unsicherheit ablesen.
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

        case "vsupPlot":
            container.appendChild (taskExplanation);
            container.appendChild (vsupPlot);
            break;

        case "vsupLegend":
            container.appendChild (vsupLegend);
            break;
        
        case "Vsup":
            // container.appendChild (vsupExplanation);
            // container.appendChild (vsupPlot);
            // container.appendChild (vsupLegend);

            // Erklärung oben
            const layout = document.createElement ("div");

            layout.style.display = "flex";
            layout.style.flexDirection = "column";
            layout.style.alignItems = "center";
            layout.style.gap = "10px";
            layout.style.width = "100%";

            layout.appendChild (vsupExplanation);

            // Plots unter den Text setzen
            const plotLayout = document.createElement ("div");

            plotLayout.style.display = "flex";
            plotLayout.style.flexDirection = "row";
            plotLayout.style.alignItems = "flex-start";
            plotLayout.style.justifyContent = "center";
            plotLayout.style.gap = "0px";
            plotLayout.style.width = "100%";

            plotLayout.appendChild (vsupPlot);
            plotLayout.appendChild (vsupLegend);

            layout.appendChild (plotLayout);

            // Alles in den Container
            container.appendChild (layout);
            break;

        default:
            container.appendChild(vsupPlot);
            break;
    }
}