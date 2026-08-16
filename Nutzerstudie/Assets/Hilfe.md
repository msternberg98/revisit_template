# Hilfe

## Aufbau

Die jeweilige Aufgabenstellung wird Ihnen während der Studie immer auf der linken Seite angezeigt.
Weitere Fragen oder Eingabefelder erscheinen unterhalb der Aufgabenstellung.

## Beantwortung der Aufgaben

Je nach Aufgabe stehen Ihnen unterschiedliche Möglichkeiten zur Beantwortung zur Verfügung:

- **Auswahl:** Bei einigen Fragen wählen Sie eine der vorgegebenen Antwortmöglichkeiten aus.
- **Texteingabe:** Bei Fragen mit einem Eingabefeld geben Sie Ihre Antwort über die Tastatur ein. Je nach Frage steht hierfür ein kurzes oder ein größeres Textfeld zur Verfügung.
- **Bewertungsskala:** Bei Bewertungsfragen wählen Sie den Punkt auf der Skala aus, der Ihrer Einschätzung am besten entspricht.
- **Rangfolge:** Bei Fragen zur Rangfolge ziehen Sie die verfügbaren Antworten mit gedrückter linker Maustaste in den dafür vorgesehenen Bereich und ordnen sie dort entsprechend der angegebenen Reihenfolge an.

## Interaktion mit den Visualisierungen

Wenn Sie aufgefordert werden, eine bestimmte Stelle in der Visualisierung auszuwählen, klicken Sie diese mit der linken Maustaste an. Die ausgewählte Stelle wird anschließend mit einem pinken Quadrat markiert. Sie können Ihre Auswahl jederzeit ändern, indem Sie auf eine andere Stelle in der Visualisierung klicken.

Innerhalb einer Visualisierung können Sie mit dem Mausrad zoomen. Zum Verschieben halten Sie die linke Maustaste gedrückt und bewegen die Maus.

## Ablauf

Bevor Sie mit den eigentlichen Aufgaben beginnen, werden Ihnen zunächst alle Visualisierungsmethoden erklärt. Anschließend wird überprüft, ob Sie die Methoden richtig verstanden haben. Sollten Sie dabei dreimal eine falsche Antwort geben, wird die Studie beendet.

Sobald Sie eine Aufgabe vollständig bearbeitet haben, klicken Sie am Ende der Seite auf **Weiter**, um zur nächsten Aufgabe zu gelangen.

Bitte bearbeiten Sie alle Aufgaben vollständig. Antworten Sie zügig, aber so genau wie möglich.

## Hinweise

Bei weiteren Fragen oder Problemen wenden Sie sich bitte an den Studienleiter: maurice.sternberg@student.uni-siegen.de


# Darstellung mit Farbsättigung

## Darstellung

Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird über die Farbsättigung dargestellt. Je höher die Unsicherheit eines Datenpunkts ist, desto stärker wird die Farbe entsättigt. Dadurch werden die Farbunterschiede zwischen verschiedenen Mittelwerten mit zunehmender Unsicherheit geringer. Beim größten Unsicherheitswert werden die Farben am stärksten mit Grau vermischt. Bereiche mit geringer Unsicherheit werden dagegen mit kräftigeren Farben dargestellt.

<img src = "Nutzerstudie\Assets\Plots\Test\Vsup\Test_VSUP_Plot.png" alt = "Darstellung mit Farbsättigung" style = "max-width: 100%; width: 300px;"/>

## Legende

Die Legende zeigt, welche Kombinationen aus Mittelwert und Unsicherheit den jeweiligen Farben entsprechen. Anhand der Legende können Sie sowohl den dargestellten Mittelwert als auch die zugehörige Unsicherheit ablesen.

<img src = "Nutzerstudie\Assets\Plots\Test\Vsup\Test_VSUP_Legende.png" alt = "Legende der Darstellung mit Farbsättigung" style = "max-width: 100%; width: 280px;"/>


# Darstellung mit Kreisgrößen

## Darstellung

Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird durch die Größe eines Kreises dargestellt. Dabei wird die Unsicherheit linear auf den Radius des Kreises abgebildet: Der kleinste Unsicherheitswert wird durch den kleinsten Kreis und der größte Unsicherheitswert durch den größten Kreis dargestellt. Auch der kleinste Unsicherheitswert wird als sichtbarer Kreis dargestellt.

<img src = "Nutzerstudie\Assets\Plots\Test\ScaledGlyph\Test_ScaledGlyph_Plot.png" alt = "Darstellung mit Kreisgrößen" style = "max-width: 100%; width: 300px;"/>

## Legende

Die Legende zeigt, welche Farben den jeweiligen Mittelwerten und welche Kreisgrößen den jeweiligen Unsicherheiten entsprechen. Anhand der Legende können Sie sowohl den dargestellten Mittelwert als auch die zugehörige Unsicherheit ablesen.

<img src = "Nutzerstudie\Assets\Plots\Test\ScaledGlyph\Test_ScaledGlyph_Legende.png" alt = "Legende der Darstellung mit Kreisgrößen" style = "max-width: 100%; width: 240px;"/>


# Darstellung mit mehreren Farbbereichen

## Darstellung

Bei dieser Visualisierung wird jeder Datenpunkt durch drei farbige Bereiche dargestellt: Der innere Kreis zeigt den Mittelwert minus Standardabweichung. Der Ring darum zeigt den Mittelwert. Der äußere Bereich zeigt den Mittelwert plus Standardabweichung. Bei geringer Unsicherheit liegen die drei Werte nah beieinander und die Bereiche haben ähnliche Farben. Bei hoher Unsicherheit unterscheiden sich die Farben der drei Bereiche stärker voneinander.

<img src = "Nutzerstudie\Assets\Plots\Test\IsoGlyph\Test_IsoGlyph_Plot.png" alt = "Darstellung mit mehreren Farbbereichen" style = "max-width: 100%; width: 300px;"/>

## Legende

Die Legende zeigt, welche Farben den jeweiligen Werten entsprechen. So können Sie die Werte der drei Bereiche anhand ihrer Farben ablesen.

<img src = "Nutzerstudie\Assets\Plots\Test\IsoGlyph\Test_IsoGlyph_Legende.png" alt = "Legende der Darstellung mit mehreren Farbbereichen" style = "max-width: 100%; width: 240px;"/>