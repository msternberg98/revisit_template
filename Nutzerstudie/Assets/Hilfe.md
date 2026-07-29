# Erklärung

In dieser Studie wird Ihnen die jeweilige Aufgabenstellung immer auf der linken Seite angezeigt.
Wenn Sie aufgefordert werden, auf eine bestimmte Stelle im Bild zu klicken, wählen Sie diese einfach mit der linken Maustaste aus. Die von Ihnen ausgewählte Stelle wird anschließend mit einem schwarzen Quadrat markiert. Sie können Ihre Auswahl jederzeit ändern, indem Sie auf eine andere Stelle im Bild klicken.
Weitere Fragen oder Eingaben erscheinen unterhalb der jeweiligen Aufgabenstellung auf der linken Seite. 
Bitte bearbeiten Sie alle Aufgaben vollständig. Nehmen Sie sich für jede Aufgabe ausreichend Zeit und beantworten Sie diese nach bestem Wissen.

Sobald Sie eine Aufgabe bearbeitet haben, klicken Sie auf **Weiter**, um zur nächsten Aufgabe zu gelangen.
Bei weiteren Fragen wenden Sie sich an den Studienleiter.

# VSUP
Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird über die Farbsättigung kodiert.Je höher die Unsicherheit eines Datenpunkts ist, desto stärker werden die Farben entsättigt. Dadurch unterscheiden sich die Farben verschiedener Mittelwerte immer weniger. Bei maximaler Unsicherheit erscheinen alle Werte nahezu grau, unabhängig vom tatsächlichen Mittelwert. Dadurch wird signalisiert, dass diese Werte mit größerer Vorsicht interpretiert werden sollten. Bereiche mit geringer Unsicherheit besitzen dagegen kräftige Farben und lassen sich genauer Unterscheiden.

<img src = "Nutzerstudie\Assets\Plots\Test\Vsup\Test_VSUP_Plot.png" alt = "VSUP-Plot" style = "max-width: 100%; width: 300px;"/>
<img src = "Nutzerstudie\Assets\Plots\Test\Vsup\Test_VSUP_Legende.png" alt = "VSUP-Legende" style = "max-width: 100%; width: 280px;"/>

# Skalierte Glyphen
Bei dieser Visualisierung wird der Mittelwert eines Datenpunkts durch die Farbe dargestellt. Die Unsicherheit (Standardabweichung) wird durch die Größe einer Kreisglyphe kodiert. Kleine Kreise stehen für geringe Unsicherheit und große Kreise für hohe Unsicherheit. Die Farbe bleibt dabei unverändert und zeigt ausschließlich den Mittelwert an.

<img src = "Nutzerstudie\Assets\Plots\Test\ScaledGlyph\Test_ScaledGlyph_Plot.png" alt = "ScaledGlyph-Plot" style = "max-width: 100%; width: 300px;"/>
<img src = "Nutzerstudie\Assets\Plots\Test\ScaledGlyph\Test_ScaledGlyph_Legende.png" alt = "ScaledGlyph-Legende" style = "max-width: 100%; width: 240px;"/>

# Isometrische Glyphen
Bei dieser Visualisierung besteht jede Glyphe aus drei Bereichen: einem äußeren Quadrat, einem äußeren Kreis und einem inneren Kreis. Der äußere Kreis stellt den Mittelwert dar. Das Quadrat zeigt den Wert Mittelwert + Standardabweichung, während der innere Kreis den Wert Mittelwert − Standardabweichung darstellt. Die Unsicherheit lässt sich über den Farbunterschied innerhalb einer Glyphe erkennen. Sollte keine Unsicherheit vorhanden sein, haben wir eine farblich einheitliche Fläche, während die Glyphe bei zunehmender Unsicherheit einen starken Kontrast hat und deutlich hervorsticht.

<img src = "Nutzerstudie\Assets\Plots\Test\IsoGlyph\Test_IsoGlyph_Plot.png" alt = "IsoGlyph-Plot" style = "max-width: 100%; width: 300px;"/>
<img src = "Nutzerstudie\Assets\Plots\Test\IsoGlyph\Test_IsoGlyph_Legende.png" alt = "IsoGlyph-Legende" style = "max-width: 100%; width: 240px;"/>