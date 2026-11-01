"""Deskriptive Auswertung der drei demografischen Studienfragen.

Datei neben Nutzerstudie_all_tidy.csv ablegen.
Ausgabe: Analysis_Output/Demografie (Excel, PNG und PDF; keine CSV-Exporte).
Benötigt: pandas, matplotlib, openpyxl.
"""
from pathlib import Path
import re

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

# 1. Konfiguration
CSV_FILENAME = "Nutzerstudie_all_tidy.csv"
INCLUDE_INCOMPLETE = False  # Standard: nur completed und nicht rejected
OUTPUT_FOLDER = Path("Analysis_Output") / "Demografie"
SHOW_PLOTS = False
PLOT_COLOR = "#3676b6"

QUESTIONS = {
    "Alter": "Wie alt sind Sie?",
    "Bildungsabschluss": "Was ist ihr höchster Bildungsabschluss?",
    "Vertrautheit": "Wie vertraut sind Sie allgemein mit Unsicherheitsvisualisierungen?",
}
EDUCATION_ORDER = ["Hauptschule", "Realschule", "Gymnasium", "Bachelor", "Master"]


def age_sort_key(label):
    """Altersgruppen nach ihrer unteren Grenze anordnen."""
    match = re.search(r"\d+", str(label))
    return int(match.group()) if match else 9999, str(label)


def category_order(question, observed):
    observed = list(observed)
    if question == "Alter":
        return sorted(observed, key=age_sort_key)
    if question == "Bildungsabschluss":
        return [x for x in EDUCATION_ORDER if x in observed] + sorted(
            x for x in observed if x not in EDUCATION_ORDER)
    if question == "Vertrautheit":
        stages = [str(i) for i in range(1, 8)]
        return stages + sorted(x for x in observed if x not in stages)
    return sorted(observed)


def frequency_table(series, question, total):
    valid = series.dropna().astype(str).str.strip()
    valid = valid[~valid.isin(["", "nan", "None"])]
    # ReVISit kann Skalenwerte als "1" oder "1.0" exportieren.
    if question == "Vertrautheit":
        valid = valid.map(lambda x: str(int(float(x))) if re.fullmatch(r"[1-7](?:\.0+)?", x) else x)
    counts = valid.value_counts()
    order = category_order(question, counts.index)
    table = pd.DataFrame({
        "Antwortmöglichkeit": order,
        "Anzahl": [int(counts.get(category, 0)) for category in order],
    })
    n_valid = len(valid)
    table["Anteil (%)"] = (table["Anzahl"] / n_valid * 100).round(2) if n_valid else 0.0
    return table, n_valid, total - n_valid


def create_plot(table, question, n_valid, output_dir):
    """Ein Säulendiagramm je Frage; Schrift und Methodik wie in den übrigen Auswertungen."""
    fig_width = max(7, len(table) * 0.85)
    fig, ax = plt.subplots(figsize=(fig_width, 4.8))
    bars = ax.bar(table["Antwortmöglichkeit"], table["Anzahl"], width=0.68, color=PLOT_COLOR)
    ax.bar_label(bars, padding=3, fmt="%d", fontsize=10)
    ax.set_title(f"{question} (n = {n_valid})")
    ax.set_ylabel("Anzahl der Teilnehmenden")
    ax.set_xlabel({
        "Alter": "Altersgruppe",
        "Bildungsabschluss": "Höchster Bildungsabschluss",
        "Vertrautheit": "Vertrautheit mit Unsicherheitsvisualisierungen (Skalenwert)",
    }[question])
    maximum = int(table["Anzahl"].max()) if not table.empty else 0
    ax.set_ylim(0, max(1, maximum) * 1.2 + 0.5)
    ax.yaxis.get_major_locator().set_params(integer=True)
    ax.spines[["top", "right"]].set_visible(False)
    if question == "Bildungsabschluss":
        plt.setp(ax.get_xticklabels(), rotation=25, ha="right")
    fig.tight_layout()
    stem = {"Alter": "01_Alter", "Bildungsabschluss": "02_Bildungsabschluss",
            "Vertrautheit": "03_Vertrautheit"}[question]
    fig.savefig(output_dir / f"{stem}.png", dpi=300, bbox_inches="tight")
    fig.savefig(output_dir / f"{stem}.pdf", bbox_inches="tight")
    if SHOW_PLOTS:
        plt.show()
    plt.close(fig)


def write_sheet(writer, name, sections, note):
    """Abschnittsfarben und Textumbruch entsprechend der anderen Auswertungen."""
    ws = writer.book.create_sheet(name)
    ws.sheet_view.showGridLines = False
    ncols = max([2] + [len(frame.columns) for _, frame, _ in sections])
    widths = [19.0] * ncols
    for _, frame, _ in sections:
        for j, column in enumerate(frame.columns):
            samples = [str(column)] + [str(v) for v in frame.iloc[:100, j] if pd.notna(v)]
            widths[j] = max(widths[j], min(65, max(map(len, samples), default=16) + 3))
    if name == "00_Lesehilfe":
        widths[0], widths[1] = max(32, widths[0]), 95
    for j, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(j)].width = width

    def lines(value, width):
        available = max(8, int(width) - 4)
        return sum(max(1, (len(part) + available - 1) // available)
                   for part in str(value).split("\n"))

    def banner(row, message, color, foreground="FFFFFF"):
        for j in range(1, ncols + 1):
            ws.cell(row, j).fill = PatternFill("solid", fgColor=color)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
        cell = ws.cell(row, 1, message)
        cell.font = Font(bold=(foreground == "FFFFFF"), color=foreground, size=11)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        width = sum(widths) * 0.85
        ws.row_dimensions[row].height = max(30, min(130, 16 * lines(message, width) + 12))

    banner(1, note, "23415C")
    row = 3
    for heading, frame, description in sections:
        banner(row, heading, "3676B6")
        row += 1
        if description:
            banner(row, description, "EAF0F6", "20354A")
            row += 1
        for j, column in enumerate(frame.columns, 1):
            cell = ws.cell(row, j, str(column))
            cell.font = Font(bold=True, color="20354A")
            cell.fill = PatternFill("solid", fgColor="D7E5F1")
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = max(30, min(90, 16 * max(
            lines(column, widths[j]) for j, column in enumerate(frame.columns)) + 8))
        row += 1
        for values in frame.itertuples(index=False, name=None):
            max_lines = 1
            for j, value in enumerate(values, 1):
                if pd.isna(value):
                    value = None
                cell = ws.cell(row, j, value)
                numeric = isinstance(value, (int, float)) and not isinstance(value, bool)
                cell.alignment = Alignment(vertical="center", wrap_text=True,
                                           horizontal="center" if numeric else "left")
                if isinstance(value, float):
                    cell.number_format = '#,##0.00;[Red]-#,##0.00'
                if value is not None:
                    max_lines = max(max_lines, lines(value, widths[j - 1]))
            ws.row_dimensions[row].height = max(23, min(420, 16 * max_lines + 7))
            row += 1
        row += 2


def main():
    folder = Path(__file__).resolve().parent
    source = folder / CSV_FILENAME
    if not source.exists():
        raise FileNotFoundError(f"CSV nicht gefunden: {source}")
    output = folder / OUTPUT_FOLDER
    output.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(source, low_memory=False, dtype={"participantId": str})
    required = {"participantId", "trialId", "status", "responsePrompt", "answer"}
    if missing := required - set(df.columns):
        raise ValueError(f"Fehlende CSV-Spalten: {sorted(missing)}")

    if not INCLUDE_INCOMPLETE:
        info = df.groupby("participantId").status.agg(
            completed=lambda s: s.eq("completed").any(),
            rejected=lambda s: s.eq("rejected").any())
        keep = info.index[info.completed & ~info.rejected]
        df = df[df.participantId.isin(keep)].copy()
    total = df.participantId.nunique()
    demo = df[df.trialId.eq("Demographic") & df.responsePrompt.isin(QUESTIONS.values())]
    if demo.duplicated(["participantId", "responsePrompt"]).any():
        raise ValueError("Mehrfachantworten für dieselbe Person/Frage gefunden")
    wide = demo.pivot(index="participantId", columns="responsePrompt", values="answer")
    wide = wide.reindex(index=sorted(df.participantId.dropna().unique()), columns=list(QUESTIONS.values()))

    overview, tables = [], {}
    for question, prompt in QUESTIONS.items():
        table, n_valid, n_missing = frequency_table(wide[prompt], question, total)
        tables[question] = table
        overview.append({"Frage": question, "Berücksichtigte Teilnehmende": total,
                         "Gültige Antworten": n_valid, "Fehlende Antworten": n_missing})
        create_plot(table, question, n_valid, output)
        print(f"{question}: {n_valid} gültige Antworten, {n_missing} fehlend")

    age_counts = tables["Alter"].set_index("Antwortmöglichkeit")["Anzahl"]
    edu_counts = tables["Bildungsabschluss"].set_index("Antwortmöglichkeit")["Anzahl"]
    def modal_labels(counts):
        return ", ".join(counts[counts.eq(counts.max())].index) if not counts.empty and counts.max() > 0 else "Keine Angaben"
    findings = pd.DataFrame([
        ("Häufigste Altersgruppe", modal_labels(age_counts)),
        ("Häufigster Bildungsabschluss", modal_labels(edu_counts)),
    ], columns=["Kennwert", "Ergebnis"])
    guide = pd.DataFrame([
        ("Datenbasis", "Nur completed und nicht rejected (sofern INCLUDE_INCOMPLETE=False)."),
        ("Stichprobengröße", "Gesamtzahl der berücksichtigten Personen; fehlende Demografieantworten zählen nicht als gültig."),
        ("Gültige Antworten", "Je Frage eine nichtleere Antwort pro Person."),
        ("Anteil (%)", "100 × Häufigkeit der Antwortkategorie / gültige Antworten dieser Frage."),
        ("Vertrautheit", "Siebenstufige Skala: 1–7 werden auch bei einer Häufigkeit von null dargestellt."),
        ("Häufigste Kategorie", "Bei gleichen Maximalhäufigkeiten werden alle gleich häufigen Kategorien genannt."),
        ("Aufgabenanordnungen", "Die vier Anordnungen benötigen eine gesonderte, eindeutige Zuordnung; sie werden aus den Demografieantworten nicht abgeleitet."),
    ], columns=["Begriff", "Bedeutung / Berechnung"])
    with pd.ExcelWriter(output / "00_Demografie_Auswertung.xlsx", engine="openpyxl") as writer:
        write_sheet(writer, "00_Lesehilfe", [("Berechnungsgrundlagen", guide, "")],
                    "Hinweise zur demografischen Auswertung")
        write_sheet(writer, "Übersicht", [
            ("A. Stichprobe und Vollständigkeit", pd.DataFrame(overview),
             "Je Frage wird die Anzahl gültiger und fehlender Antworten ausgewiesen."),
            ("B. Ergänzende Kennwerte", findings,
             "Häufigste Kategorien anhand der beobachteten Häufigkeiten; Gleichstände werden gemeinsam angezeigt.")
        ], "Demografie | Stichprobe und zentrale Angaben")
        for question, table in tables.items():
            write_sheet(writer, question, [("Antwortverteilung", table,
                "Anteil (%) bezieht sich auf die gültigen Antworten dieser Frage.")],
                f"Demografie | {question}")
    print(f"Teilnehmende insgesamt: {total}; Ausgabe: {output}")


if __name__ == "__main__":
    main()
