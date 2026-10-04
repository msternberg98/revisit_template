"""
Deskriptive Auswertung der drei demografischen Studienfragen.
Ausgabe: analysis_output/demografie/ (Excel, CSV und Grafiken als PNG/PDF).
Benötigt: pandas, matplotlib, openpyxl.
"""

from pathlib import Path
import re
import pandas as pd
import matplotlib.pyplot as plt

# 1. Konfiguration – nur diesen Bereich bei Bedarf anpassen

CSV_FILENAME = "Nutzerstudie_all_tidy.csv"
# CSV_FILENAME = "Nutzerstudie_all_tidy_Test.csv"
INCLUDE_INCOMPLETE = False  # Wie in der bisherigen Gesamtauswertung
OUTPUT_FOLDER = Path ("Analysis_Output") / "Demografie"
SHOW_PLOTS = False  # True: Grafiken zusätzlich in Fenstern öffnen

# Fragen genau wie im vorhandenen ReVISit-Export.
QUESTIONS = {
    "Alter": "Wie alt sind Sie?",
    "Bildungsabschluss": "Was ist ihr höchster Bildungsabschluss?",
    "Vertrautheit": "Wie vertraut sind Sie allgemein mit Unsicherheitsvisualisierungen?",
}

# Feste inhaltliche Reihenfolge statt alphabetischer Sortierung.
EDUCATION_ORDER = ["Hauptschule", "Realschule", "Gymnasium", "Bachelor", "Master",]

def age_sort_key (label):
    """Sortiert Altersgruppen anhand ihrer ersten Zahl (18-24 vor 25-29)."""
    match = re.search (r"\d+", str (label))
    return (int (match.group ()) if match else 9999, str (label))


def category_order (question, observed):
    """Erhält für jede Frage eine nachvollziehbare Achsenreihenfolge."""
    observed = list (observed)
    if question == "Alter":
        return sorted (observed, key = age_sort_key)
    if question == "Bildungsabschluss":
        return [x for x in EDUCATION_ORDER if x in observed] + sorted (
            [x for x in observed if x not in EDUCATION_ORDER]
        )
    if question == "Vertrautheit":
        # Likert-Werte numerisch aufsteigend; unbeobachtete Stufen 1–7 anzeigen.
        return [str (i) for i in range (1, 8)] + sorted (
            [x for x in observed if x not in {str (i) for i in range (1, 8)}]
        )
    return sorted (observed)


def frequency_table (series, question, total_participants):
    """Zählt jede Antwort einmal; fehlende Angaben separat dokumentieren."""
    valid = series.dropna ().astype (str).str.strip ()
    valid = valid [~valid.isin (["", "nan", "None"])]
    counts = valid.value_counts ()
    order = category_order (question, counts.index)
    table = pd.DataFrame ({
        "Antwortmöglichkeit": order,
        "Anzahl": [int(counts.get (category, 0)) for category in order],
    })
    n_valid = len (valid)
    table ["Anteil (%)"] = (
        (table ["Anzahl"] / n_valid * 100).round (2) if n_valid else 0.0
    )
    return table, n_valid, total_participants - n_valid


def create_plot (table, question, n_valid, output_dir):
    """Erstellt je Frage ein beschriftetes Säulendiagramm in zwei Formaten."""
    fig_width = max (7, len (table) * 0.85)
    fig, ax = plt.subplots (figsize = (fig_width, 4.8))
    bars = ax.bar (table ["Antwortmöglichkeit"], table ["Anzahl"], width = 0.68)
    ax.bar_label (bars, padding = 3, fmt = "%d")
    ax.set_title (f"{question} (n = {n_valid})")
    ax.set_ylabel ("Anzahl der Teilnehmenden")
    ax.set_xlabel ({
        "Alter": "Altersgruppe",
        "Bildungsabschluss": "Höchster Bildungsabschluss",
        "Vertrautheit": "Vertrautheit mit Unsicherheitsvisualisierungen (Skalenwert)",
    } [question])
    ax.set_ylim (0, max (1, int (table ["Anzahl"].max ()) if not table.empty else 1) * 1.2 + 0.5)
    ax.yaxis.get_major_locator ().set_params (integer = True)
    ax.spines [["top", "right"]].set_visible (False)
    if question == "Bildungsabschluss":
        plt.setp (ax.get_xticklabels (), rotation = 25, ha = "right")
    fig.tight_layout ()
    stem = {"Alter": "01_Alter", "Bildungsabschluss": "02_Bildungsabschluss", "Vertrautheit": "03_Vertrautheit"} [question]
    fig.savefig (output_dir / f"{stem}.png", dpi=300, bbox_inches = "tight")
    fig.savefig (output_dir / f"{stem}.pdf", bbox_inches = "tight")
    if SHOW_PLOTS:
        plt.show ()
    plt.close (fig)


def main ():
    # 2. Einlesen der Daten und filtern
    folder = Path (__file__).resolve ().parent
    source = folder / CSV_FILENAME
    if not source.exists ():
        raise FileNotFoundError (f"CSV nicht gefunden: {source}")
    output_dir = folder / OUTPUT_FOLDER
    output_dir.mkdir (parents = True, exist_ok = True)
    df = pd.read_csv (source, low_memory = False, dtype = {"participantId": str})
    required = {"participantId", "percentComplete", "trialId", "status", "responsePrompt", "answer"}
    if missing := required.difference (df.columns):
        raise ValueError (f"Fehlende CSV-Spalten: {sorted (missing)}")

    if not INCLUDE_INCOMPLETE:
        pc = pd.to_numeric (df ["percentComplete"], errors = "coerce")

        # Teilnehmerbezogene Informationen ermitteln.
        participant_info = df.assign (_pc = pc).groupby ("participantId").agg (
            max_pc = ("_pc", "max"),
            has_completed = ("status", lambda s: s.eq ("completed").any ()),
            has_rejected = ("status", lambda s: s.eq ("rejected").any ()),
        )

        # Rejected ausschließen; completed immer berücksichtigen.
        # In progress nur bei 100 % berücksichtigen.
        keep = participant_info.index [
            ~participant_info ["has_rejected"]
            & (
                participant_info ["has_completed"]
                | (participant_info ["max_pc"] >= 100)
            )
        ]

        df = df [df ["participantId"].isin (keep)].copy ()

    total = df ["participantId"].nunique ()
    demo = df [df ["trialId"] == "Demographic"].copy ()
    demo = demo [demo ["responsePrompt"].isin (QUESTIONS.values ())]

    # 3. ReVISit Fehler Prüfung
    duplicates = demo.duplicated (["participantId", "responsePrompt"], keep = False)
    if duplicates.any ():
        raise ValueError ("Mehrfachantworten für dieselbe Person/Frage gefunden. Bitte Rohdaten prüfen.")
    wide = demo.pivot (index = "participantId", columns = "responsePrompt", values = "answer")
    wide = wide.reindex (columns = list (QUESTIONS.values ()))
    # Auch vollständig abgeschlossene Personen ohne Demografie-Einträge berücksichtigen.
    wide = wide.reindex (sorted (df ["participantId"].unique ()))

    # 4. Häufigkeiten berechnen und Grafiken erstellen
    overview = []
    tables = {}
    for question, prompt in QUESTIONS.items ():
        table, n_valid, n_missing = frequency_table (wide [prompt], question, total)
        tables [question] = table
        overview.append ({
            "Frage": question, 
            "Berücksichtigte Teilnehmende": total,
            "Gültige Antworten": n_valid,
        })
        table.to_csv (output_dir / f"{question}_Haeufigkeiten.csv", sep=";", decimal=",", encoding="utf-8-sig", index=False)
        create_plot (table, question, n_valid, output_dir)
        print (f"\n {question}: {n_valid} gültige Antworten")
        print (table.to_string (index = False))

    # 5. Excel Übersicht
    excel_path = output_dir / "00_Demografie_Auswertung.xlsx"
    with pd.ExcelWriter (excel_path, engine = "openpyxl") as writer:
        pd.DataFrame (overview).to_excel (writer, sheet_name = "Übersicht", index = False)
        for name, table in tables.items ():
            table.to_excel (writer, sheet_name = name, index = False)
        for sheet in writer.book.worksheets:
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions
            for cell in sheet [1]:
                cell.font = __import__("openpyxl").styles.Font (bold = True)
            for column in sheet.columns:
                letter = column [0].column_letter
                sheet.column_dimensions [letter].width = min (55, max (17, max (len (str (c.value or "")) for c in column) + 3))
    print (f"\nFertig. Dateien gespeichert unter: {output_dir}")


if __name__ == "__main__":
    main ()
