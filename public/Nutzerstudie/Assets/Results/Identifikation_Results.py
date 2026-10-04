"""Minima-/Maxima-Aufgaben: absolute und normalisierte Fehler, Rangvergleiche, Diagnostik.

Datei neben Nutzerstudie_all_tidy.csv ablegen; Ausgabe: Analysis_Output/Identifikation.

Benötigt: pandas, numpy, matplotlib, openpyxl, scipy.

"""

from pathlib import Path

import re

import numpy as np

import pandas as pd

import matplotlib.pyplot as plt

from scipy import stats

from openpyxl.styles import Font, Alignment, PatternFill



# 1. Konfiguration

CSV_FILENAME = "Nutzerstudie_all_tidy.csv"

# CSV_FILENAME = "Nutzerstudie_all_tidy_Test.csv"

INCLUDE_INCOMPLETE = False

OUTPUT_FOLDER = Path("Analysis_Output") / "Identifikation"

SHOW_PLOTS = False

TOLERANCE_PERCENT = 1.0  # Nur deskriptiv: Fehler <= 1 % der Variablenspanne.

METHODS = ["VSUP", "ScaledGlyph", "IsoGlyph"]

METHOD_LABELS = {"VSUP": "VSUP", "ScaledGlyph": "Scaled Glyph", "IsoGlyph": "IsoGlyph"}

COLORS = {"VSUP": "#3676b6", "ScaledGlyph": "#e5a343", "IsoGlyph": "#779b7b"}

TASKS = ["Niederschlag_Uncertainty_Maxima", "Niederschlag_Uncertainty_Minima",

         "Luftdruck_Value_Maxima", "Luftdruck_Value_Minima"]

TASK_LABELS = {"Niederschlag_Uncertainty_Maxima": "Unsicherheit: Maximum",

               "Niederschlag_Uncertainty_Minima": "Unsicherheit: Minimum",

               "Luftdruck_Value_Maxima": "Mittelwert: Maximum",

               "Luftdruck_Value_Minima": "Mittelwert: Minimum"}

TRIAL_PATTERN = re.compile(r"^(Niederschlag_Uncertainty_(?:Maxima|Minima)|Luftdruck_Value_(?:Maxima|Minima))_(VSUP|ScaledGlyph|IsoGlyph)$")





def save_plot(fig, folder, name, legend=False):

    """PNG und PDF speichern; Legende gegebenenfalls fest rechts außerhalb."""

    fig.tight_layout(rect=(0, 0, .82, 1) if legend else (0, 0, 1, 1))

    fig.savefig(folder / f"{name}.png", dpi=300, bbox_inches="tight")

    fig.savefig(folder / f"{name}.pdf", bbox_inches="tight")

    if SHOW_PLOTS:

        plt.show()

    plt.close(fig)





def describe(values):

    """Deskriptive Kennzahlen ohne automatische Entfernung statistischer Ausreißer."""

    s = pd.Series(values).dropna().astype(float)

    if s.empty:

        return {"n": 0, "Mittelwert": np.nan, "Median": np.nan, "Standardabweichung": np.nan,

                "Q1": np.nan, "Q3": np.nan, "IQR": np.nan}

    q1, q3 = s.quantile([.25, .75])

    return {"n": len(s), "Mittelwert": s.mean(), "Median": s.median(),

            "Standardabweichung": s.std(ddof=1) if len(s) > 1 else np.nan,

            "Q1": q1, "Q3": q3, "IQR": q3-q1}





def parse_trials(df):

    """Nur numerische Klickantworten mit correctAnswer, keine Sicherheits-Likerts."""

    rows = []

    for r in df.to_dict ("records"):

        match = TRIAL_PATTERN.fullmatch (str(r.get ("trialId", "")))

        if not match:

            continue

        task, method = match.groups()

        correct = pd.to_numeric(r.get("correctAnswer"), errors="coerce")

        if pd.isna(correct):

            continue  # Die weiteren Trial-Zeilen sind keine Identifikationsantworten.

        raw = pd.to_numeric(r.get("answer"), errors="coerce")

        valid = pd.notna(raw) and np.isfinite(raw) and raw != -999

        duration = pd.to_numeric(r.get("cleanedDuration"), errors="coerce")

        if pd.isna(duration):

            duration = pd.to_numeric(r.get("duration"), errors="coerce")

        rows.append({"Teilnehmer": str(r["participantId"]), "Aufgabe": task,

                     "Methode": method, "Antwort": float(raw) if valid else np.nan,

                     "Sollwert": float(correct), "Gültig": bool(valid),

                     "Ungültigkeitsgrund": "" if valid else ("-999 (keine Antwort)" if raw == -999 else "Fehlend/nicht numerisch"),

                     "Zeit_s": float(duration)/1000 if pd.notna(duration) and duration >= 0 else np.nan,

                     "trialOrder": r.get("trialOrder")})

    out = pd.DataFrame(rows)

    if out.empty:

        raise ValueError("Keine Identifikationsaufgaben gefunden. trialId und correctAnswer prüfen.")

    duplicates = out.duplicated(["Teilnehmer", "Aufgabe", "Methode"], keep=False)

    if duplicates.any():

        raise ValueError("Doppelte Identifikationsantworten gefunden; Rohdaten prüfen:\n" +

                         out.loc[duplicates, ["Teilnehmer", "Aufgabe", "Methode"]].to_string(index=False))

    # Referenzspanne stammt aus den beiden tatsächlichen Extrema der jeweiligen Variable.

    out["Variable"] = out["Aufgabe"].str.replace(r"_(?:Maxima|Minima)$", "", regex=True)

    reference = out.groupby(["Variable", "Aufgabe"])["Sollwert"].agg(["min", "max"])

    if (reference["max"]-reference["min"] > 1e-9).any():

        raise ValueError("Widersprüchliche Sollwerte für dieselbe Aufgabe: Rohdaten prüfen.")

    spans = out.groupby("Variable")["Sollwert"].agg(["min", "max"])

    spans["Spanne"] = spans["max"]-spans["min"]

    if spans["Spanne"].isna().any() or (spans["Spanne"] <= 0).any():

        raise ValueError("Wertspanne fehlt/ist null. Für jede Variable müssen Min und Max vorliegen.")

    out["Wertspanne"] = out["Variable"].map(spans["Spanne"])

    out["Fehler_absolut"] = (out["Antwort"]-out["Sollwert"]).abs()

    out["Fehler_%"] = 100*out["Fehler_absolut"]/out["Wertspanne"]

    out["Exakt"] = out["Gültig"] & np.isclose(out["Antwort"], out["Sollwert"], rtol=0, atol=1e-10)

    out["Innerhalb_1%"] = out["Gültig"] & (out["Fehler_%"] <= TOLERANCE_PERCENT + 1e-10)

    out["Exakt"] = out["Exakt"].astype("boolean")

    out["Innerhalb_1%"] = out["Innerhalb_1%"].astype("boolean")

    out.loc[~out["Gültig"], ["Exakt", "Innerhalb_1%"]] = pd.NA

    # Auffällige Fehler pro Aufgabe und Methode markieren; NIEMALS automatisch entfernen.

    out["IQR_auffällig"] = False

    thresholds = []

    for (task, method), grp in out[out["Gültig"]].groupby(["Aufgabe", "Methode"]):

        q1, q3 = grp["Fehler_absolut"].quantile([.25, .75]); iqr = q3-q1

        upper = q3 + 1.5*iqr

        # Bei IQR=0 ist die Markierung wenig aussagekräftig: nur dokumentieren.

        applicable = len(grp) >= 4 and iqr > 0

        out.loc[grp.index, "IQR_auffällig"] = applicable & (grp["Fehler_absolut"] > upper)

        thresholds.append({"Aufgabe": task, "Methode": method, "n": len(grp), "Q1": q1,

                           "Q3": q3, "IQR": iqr, "Obere_Grenze": upper,

                           "IQR_anwendbar": applicable,

                           "Auffällige": int(out.loc[grp.index, "IQR_auffällig"].sum())})

    return out, pd.DataFrame(thresholds), spans.reset_index()





def rank_table(wide):

    """Gleichstände mit Mittelrängen; Erstplätze bei Gleichstand anteilig vergeben."""

    ranks = wide.rank(axis=1, method="average", ascending=True)

    wins = wide.eq(wide.min(axis=1), axis=0).div(wide.eq(wide.min(axis=1), axis=0).sum(axis=1), axis=0)

    ties = wide.apply(lambda row: row.map(row.value_counts()).gt(1), axis=1)

    rows = []

    for method in METHODS:

        vals = ranks[method]

        rows.append({"Methode": method, "n": len(wide), "Mittlerer_Rang": vals.mean(),

                     "Anteil_Erstplatz_%": wins[method].mean()*100,

                     "Erstplatz_gewichtet": wins[method].sum(),

                     "Rang_1": int((vals == 1).sum()), "Rang_2": int((vals == 2).sum()),

                     "Rang_3": int((vals == 3).sum()), "An Gleichständen beteiligt": int(ties[method].sum())})

    return pd.DataFrame(rows), ranks, wins





def friedman_comparison(wide, title):

    """Gepaarter Friedman-Test; paarweise Wilcoxon nur bei p<.05, Holm-Korrektur."""

    if len(wide) < 3:

        return [{"Vergleich": title, "Test": "Friedman", "n": len(wide), "Hinweis": "Zu wenige vollständige Personen"}]

    if (wide.nunique(axis=1) == 1).all():

        return [{"Vergleich": title, "Test": "Friedman", "n": len(wide), "Hinweis": "Alle Methoden identisch"}]

    stat, p = stats.friedmanchisquare(*(wide[m] for m in METHODS))

    result = [{"Vergleich": title, "Test": "Friedman", "n": len(wide), "Statistik": stat, "p": p,

               "Kendall_W": stat/(len(wide)*(len(METHODS)-1)), "Signifikanz (p < 0.05)": "Signifikant" if p < 0.05 else "Nicht signifikant", "Hinweis": ""}]

    if p < .05:

        pairs = [(METHODS[0], METHODS[1]), (METHODS[0], METHODS[2]), (METHODS[1], METHODS[2])]

        tests = []

        for a, b in pairs:

            diff = wide[a]-wide[b]

            if np.allclose(diff, 0):

                tests.append((a, b, 0., 1.))

            else:

                w, wp = stats.wilcoxon(wide[a], wide[b], zero_method="wilcox", alternative="two-sided")

                tests.append((a, b, w, wp))

        # Holm: sortierte p-Werte schrittweise adjustieren, monoton halten.

        ordered = sorted(range(3), key=lambda i: tests[i][3]); adj = [None]*3; previous = 0.

        for k, idx in enumerate(ordered):

            previous = max(previous, min(1., tests[idx][3]*(3-k)))

            adj[idx] = previous

        for (a,b,w,wp), ap in zip(tests, adj):

            result.append({"Vergleich": title, "Test": f"Wilcoxon: {a} / {b}", "n": len(wide),

                           "Statistik": w, "p": wp, "p_Holm": ap, "Hinweis": "Explorativ; paarweise"})

    return result





def grouped_plot(table, value, ylabel, folder, filename, scientific=False):

    """Vier Aufgabentypen, jeweils drei Methoden nebeneinander; Legende fest rechts."""

    fig, ax = plt.subplots(figsize=(10, 5.5)); shown = [t for t in TASKS if t in table.Aufgabe.values]

    x = np.arange(len(shown)); width = .25

    for i, method in enumerate(METHODS):

        vals = [table.loc[(table.Aufgabe == t)&(table.Methode == method), value].iloc[0]

                if ((table.Aufgabe == t)&(table.Methode == method)).any() else np.nan for t in shown]

        ax.bar(x+(i-1)*width, vals, width, color=COLORS[method], label=METHOD_LABELS[method])

    ax.set_xticks(x, [TASK_LABELS[t] for t in shown], rotation=15, ha="right")

    ax.set_ylabel(ylabel); ax.set_ylim(bottom=0)
    if scientific:
        # Wissenschaftliche Notation als ×10ⁿ statt der Schreibweise 1e-n.
        ax.ticklabel_format(axis="y", style="sci", scilimits=(0, 0), useMathText=True)

    ax.legend(loc="center left", bbox_to_anchor=(1.02,.5), borderaxespad=0)

    ax.spines[["top","right"]].set_visible(False)

    save_plot(fig, folder, filename, legend=True)





def main():

    folder = Path(__file__).resolve().parent

    source = folder/CSV_FILENAME

    if not source.exists():

        raise FileNotFoundError(f"CSV nicht gefunden: {source}")

    outdir = folder/OUTPUT_FOLDER

    outdir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(source, low_memory=False, dtype={"participantId": str})

    needed = {"participantId","percentComplete","trialId","status","answer","correctAnswer","duration"}

    if needed-set(df.columns):

        raise ValueError(f"Fehlende Spalten: {sorted(needed-set(df.columns))}")

    if not INCLUDE_INCOMPLETE:

        pc = pd.to_numeric (df ["percentComplete"], errors = "coerce")



        participant_info = df.assign (_pc = pc).groupby ("participantId").agg (

            max_pc = ("_pc", "max"),

            has_completed = ("status", lambda s: s.eq ("completed").any ()),

            has_rejected = ("status", lambda s: s.eq ("rejected").any ()),

        )



        keep = participant_info.index [

            ~participant_info ["has_rejected"]

            & (

                participant_info ["has_completed"]

                | (participant_info ["max_pc"] >= 100)

            )

        ]



        df = df [df ["participantId"].isin (keep)].copy ()

    n_participants = df.participantId.nunique()

    trials, thresholds, spans = parse_trials(df)

    # Für einen fairen Vergleich nur vollständige Methodentripel derselben Aufgabe.

    valid = trials[trials.Gültig].copy()

    triples = valid.pivot(index=["Teilnehmer","Aufgabe"], columns="Methode", values="Fehler_%").reindex(columns=METHODS).dropna()

    # Gesamtvergleich: dieselben Personen müssen alle vier Aufgaben mit allen Methoden besitzen.

    complete_people = triples.reset_index().groupby("Teilnehmer")["Aufgabe"].nunique()

    complete_people = complete_people[complete_people == len(TASKS)].index

    total_trials = valid[valid.Teilnehmer.isin(complete_people)]

    overall = total_trials.groupby(["Teilnehmer","Methode"])["Fehler_%"].mean().unstack().reindex(columns=METHODS).dropna()

    # Aufgabenspezifische Tabellen: absolute Werte + Prozentwerte, exakt + 1%-Toleranz.

    summary=[]

    for task in TASKS:

        for method in METHODS:

            g=trials[(trials.Aufgabe==task)&(trials.Methode==method)]

            good=g[g.Gültig]

            desc=describe(good.Fehler_absolut)

            norm=describe(good["Fehler_%"])

            summary.append({"Aufgabe":task,"Methode":method,"n_gesamt":len(g),"n_gültig":len(good),

                            "n_ungültig":len(g)-len(good),"Exakt":int(good.Exakt.sum()),

                            "Innerhalb_1%":int(good["Innerhalb_1%"].sum()),

                            "Exakt_%":100*good.Exakt.mean() if len(good) else np.nan,

                            "Innerhalb_1%_%":100*good["Innerhalb_1%"].mean() if len(good) else np.nan,

                            **{f"Fehler_abs_{k}":v for k,v in desc.items() if k!="n"},

                            **{f"Fehler_%_{k}":v for k,v in norm.items() if k!="n"},

                            **{f"Zeit_s_{k}":v for k,v in describe(good.Zeit_s).items() if k in ("Mittelwert","Median","Standardabweichung")}})

    summary=pd.DataFrame(summary)
    # Interne Bezeichnungen bleiben für Grafiken unverändert; Export erhält
    # sprechende, eindeutig unterscheidbare Spaltenüberschriften.
    summary_export = summary.rename(columns={
        **{f"Fehler_abs_{k}": f"Absoluter Fehler – {k}" for k in
           ("Mittelwert", "Median", "Standardabweichung", "Q1", "Q3", "IQR")},
        **{f"Fehler_%_{k}": f"Normalisierter Fehler (%) – {k}" for k in
           ("Mittelwert", "Median", "Standardabweichung", "Q1", "Q3", "IQR")},
        **{f"Zeit_s_{k}": f"Zeit (s) – {k}" for k in
           ("Mittelwert", "Median", "Standardabweichung")},
        "n_gesamt": "Antworten insgesamt", "n_gültig": "Gültige Antworten",
        "n_ungültig": "Ungültige Antworten", "Exakt": "Exakte Antworten",
        "Innerhalb_1%": "Antworten innerhalb 1 %",
        "Exakt_%": "Exakte Antworten (%)",
        "Innerhalb_1%_%": "Antworten innerhalb 1 % (%)",
    })

    overall_desc=pd.DataFrame([{"Methode":m,**describe(overall[m])} for m in METHODS])

    overall_ranks, personal_ranks, wins=rank_table(overall) if len(overall) else (pd.DataFrame(),pd.DataFrame(),pd.DataFrame())

    bytask_rank=[]; bytask_stat=[]; bytask_personal=[]

    for task in TASKS:

        w=triples.xs(task,level="Aufgabe") if task in triples.index.get_level_values("Aufgabe") else pd.DataFrame(columns=METHODS)

        if len(w):

            rt,pr,_=rank_table(w);rt.insert(0,"Aufgabe",task);bytask_rank.append(rt)

            temp=pr.reset_index();temp.insert(1,"Aufgabe",task);bytask_personal.append(temp)

        # Vier Einzeltests explorativ; die Hauptanalyse ist der Gesamtvergleich.

        bytask_stat.extend(friedman_comparison(w,task))

    tests=friedman_comparison(overall,"Gesamt: normalisierte Abweichung")

    # Sekundäre Bearbeitungszeit nur für vollständige, gültige Zeittripel.

    times=valid.pivot(index=["Teilnehmer","Aufgabe"],columns="Methode",values="Zeit_s").reindex(columns=METHODS).dropna()

    time_complete=times.reset_index().groupby("Teilnehmer")["Aufgabe"].nunique()

    time_people=time_complete[time_complete==len(TASKS)].index

    time_overall=times.loc[times.index.get_level_values("Teilnehmer").isin(time_people)]

    time_overall=time_overall.groupby(level="Teilnehmer").mean().reindex(columns=METHODS)

    time_desc=pd.DataFrame([{"Methode":m,**describe(time_overall[m])} for m in METHODS])

    time_tests=friedman_comparison(time_overall,"Gesamt: Zeit (s)")

    # Sensitivität: keine Ausreißer entfernen, nur Vergleich ohne markierte Werte dokumentieren.

    noflag=valid[~valid.IQR_auffällig]

    sensitivity=no_flag_summary(noflag, complete_people)

    # Reihenfolge bildet die beiden Auswertungswege ab:
    # persönliche Mittelwerte -> Gesamtvergleich; einzelne Aufgaben -> Aufgabenvergleich.
    exports = {
        "Einzelantworten": trials,
        "Personen_Fehler": overall.reset_index(),
        "Gesamt_Fehler": overall_desc,
        "Personen_Rang": personal_ranks.reset_index() if len(personal_ranks) else pd.DataFrame(),
        "Gesamt_Rang": overall_ranks,
        "Tests_Gesamt": pd.DataFrame(tests),
        "Aufgabenvergleich": summary_export,
        "Personen_Aufgaben_Rang": pd.concat(bytask_personal, ignore_index=True) if bytask_personal else pd.DataFrame(),
        "Aufgaben_Rang": pd.concat(bytask_rank, ignore_index=True) if bytask_rank else pd.DataFrame(),
        "Tests_Aufgaben": pd.DataFrame(bytask_stat),
        "Zeit": time_desc,
        "Zeit_Tests": pd.DataFrame(time_tests),
        "Ausreißer_Grenzen": thresholds,
        "Sensitivität": sensitivity,
    }
    descriptions = {
        "Einzelantworten": "Alle Identifikationsversuche der eingeschlossenen Personen. -999 ist keine gültige Antwort. Absolute Fehler = |Antwort - Sollwert|; normalisierte Fehler = 100 × absoluter Fehler / Referenzspanne.",
        "Personen_Fehler": "Nur Personen mit zwölf gültigen Identifikationsantworten. Jede Zeile enthält den mittleren normalisierten Fehler (%) einer Person über die vier Aufgabentypen, getrennt nach Methode. Niedriger ist besser.",
        "Gesamt_Fehler": "Deskriptive Verteilung der persönlichen Mittelwerte aus Personen_Fehler, getrennt nach Methode (nicht die direkte Verteilung aller Einzelantworten). Alle Fehlerangaben in Prozent der jeweiligen Referenzspanne.",
        "Personen_Rang": "Aus Personen_Fehler: Innerhalb jeder Person werden die Methoden nach ihrem persönlichen mittleren normalisierten Fehler geordnet. Rang 1 = geringster Fehler; gleiche Werte erhalten Mittelränge.",
        "Gesamt_Rang": "Zusammenfassung der persönlichen Rangplätze aus Personen_Rang. Gewichtete Erstplätze werden bei Gleichstand gleichmäßig aufgeteilt; 'An Gleichständen beteiligt' zählt jede Methode mit mindestens einem gleichen Fehler innerhalb einer Person.",
        "Tests_Gesamt": "Friedman-Test der drei Methoden anhand der persönlichen Mittelwerte aus Personen_Fehler. Bei signifikantem Omnibustest folgen paarweise Wilcoxon-Tests mit Holm-Korrektur.",
        "Aufgabenvergleich": "Je Aufgabentyp und Methode: alle jeweils gültigen Einzelantworten. Absoluter Fehler in Originaleinheiten; normalisierter Fehler in % der Variablenspanne. Stichprobengrößen können je Kombination abweichen.",
        "Personen_Aufgaben_Rang": "Für jede Person und jeden Aufgabentyp werden die drei Methoden anhand ihrer normalisierten Fehler geordnet. Nur vollständige gültige Methodentripel je Aufgabe.",
        "Aufgaben_Rang": "Je Aufgabentyp: Zusammenfassung der individuellen Rangplätze aus Personen_Aufgaben_Rang. Nur vollständige gültige Methodentripel derselben Aufgabe.",
        "Tests_Aufgaben": "Explorative Friedman-Tests getrennt nach Aufgabentyp; nur vollständige Methodentripel je Aufgabe. Paarweise Wilcoxon-Tests nur bei signifikantem Friedman-Test.",
        "Zeit": "Sekundäre Analyse: je Person und Methode mittlere Bearbeitungszeit über vier Aufgaben, danach deskriptive Zusammenfassung. Nur Personen mit vollständigen gültigen Zeittripeln.",
        "Zeit_Tests": "Friedman-Test der persönlichen mittleren Bearbeitungszeiten je Methode; bei Signifikanz paarweise Wilcoxon-Tests mit Holm-Korrektur.",
        "Ausreißer_Grenzen": "Diagnostik je Aufgabe und Methode: obere Grenze = Q3 + 1,5 × IQR des absoluten Fehlers. Auffällige Werte werden in der Hauptanalyse nicht entfernt.",
        "Sensitivität": "Explorative Wiederholung des Gesamtvergleichs ohne IQR-markierte Einzelwerte. Personen mit dadurch unvollständigen zwölf Aufgaben werden in dieser Zusatzanalyse ausgeschlossen.",
    }
    guide = pd.DataFrame([
        ("Absoluter Fehler", "Betrag der Differenz zwischen abgegebener Antwort und Sollwert; in der Originaleinheit der Aufgabe."),
        ("Normalisierter Fehler (%)", "100 × absoluter Fehler / (Maximum - Minimum der jeweiligen Variable); macht unterschiedliche Variablen vergleichbar."),
        ("Persönlicher mittlerer Fehler", "Durchschnitt der vier normalisierten Aufgabenfehler einer Person für eine Methode; nur bei vollständigen zwölf gültigen Antworten."),
        ("Gesamt_Fehler", "Kennzahlen über die persönlichen Mittelwerte, nicht über alle Einzelantworten direkt."),
        ("Rang", "Reihenfolge der Methoden innerhalb derselben Person: 1 = kleinster Fehler, 3 = größter Fehler."),
        ("Mittelrang", "Bei gleichen Fehlern teilen sich Methoden die betroffenen Rangplätze; z. B. 1,5 und 1,5."),
        ("An Gleichständen beteiligt", "Anzahl der Personen, bei denen die jeweilige Methode mit mindestens einer weiteren Methode exakt denselben Fehler hat; auch dreifache Gleichstände zählen."),
        ("Gewichteter Erstplatz", "Bei zwei gleich guten Erstplatzierten erhält jede 0,5; bei drei jede 1/3 Erstplatz."),
        ("Standardabweichung (SD)", "Streuung der beobachteten Werte um ihren Mittelwert; im Gesamt_Fehler Streuung der persönlichen Durchschnittsfehler."),
        ("Q1 / Q3 / IQR", "25-%-Quantil / 75-%-Quantil / Differenz Q3 - Q1."),
        ("Unterschiedliche n", "Aufgabenvergleich: alle gültigen Antworten je Kombination; Gesamtvergleich: nur Personen mit allen zwölf gültigen Antworten."),
        ("Statistische Tests", "Friedman prüft Unterschiede zwischen drei verbundenen Methoden; Holm-korrigierte Wilcoxon-Tests nur nach signifikantem Friedman-Test."),
    ], columns=["Begriff", "Erklärung"])

    # CSV-Dateien enthalten nur Datentabellen, die Excel-Datei zusätzlich Lesehinweise.
    for name, table in exports.items():
        if len(table.columns):
            table.to_csv(outdir / f"{name}.csv", index=False, sep=";", decimal=",", encoding="utf-8-sig")
    guide.to_csv(outdir / "Lesehilfe.csv", index=False, sep=";", encoding="utf-8-sig")

    with pd.ExcelWriter(outdir / "00_Identifikation_Auswertung.xlsx", engine="openpyxl") as writer:
        for name, table in [*exports.items(), ("Lesehilfe", guide)]:
            if not len(table.columns):
                continue
            description = descriptions.get(name)
            startrow = 4 if description else 0
            table.to_excel(writer, sheet_name=name[:31], index=False, startrow=startrow)
            sheet = writer.sheets[name[:31]]
            if description:
                sheet.merge_cells(start_row=1, start_column=1, end_row=3, end_column=max(2, len(table.columns)))
                cell = sheet.cell(1, 1, description)
                cell.alignment = Alignment(wrap_text=True, vertical="center")
                cell.font = Font(bold=True)
                cell.fill = PatternFill("solid", fgColor="EAF0F6")
                sheet.row_dimensions[1].height = 45
            header_row = startrow + 1
            sheet.freeze_panes = f"C{header_row + 1}" if name in ("Einzelantworten", "Aufgabenvergleich") else None
            sheet.auto_filter.ref = f"A{header_row}:{sheet.cell(header_row, len(table.columns)).column_letter}{sheet.max_row}"
            for cell in sheet[header_row]:
                cell.font = Font(bold=True)
            for col in sheet.columns:
                values = [c for c in col if c.__class__.__name__ != "MergedCell" and c.row >= header_row]
                if values:
                    sheet.column_dimensions[values[0].column_letter].width = min(
                        46, max(16, max(len(str(c.value or "")) for c in values[:150]) + 2))
            if name == "Lesehilfe":
                sheet.column_dimensions["A"].width = 32
                sheet.column_dimensions["B"].width = 95
                for row in sheet.iter_rows(min_row=2):
                    row[1].alignment = Alignment(wrap_text=True, vertical="top")
                    sheet.row_dimensions[row[1].row].height = 34

    # Absolute Werte nur innerhalb derselben physikalischen Größe darstellen.

    for variable, prefix, unit, scientific in [
        ("Luftdruck_Value", "Mittelwert", "Pa", False),
        ("Niederschlag_Uncertainty", "Unsicherheit", "mm/Tag", True),
    ]:
        selected = summary[summary.Aufgabe.str.startswith(variable)].copy()
        grouped_plot(
            selected, "Fehler_abs_Mittelwert",
            f"Mittlere absolute Abweichung ({unit})", outdir,
            f"01_Absolute_Abweichung_{prefix}", scientific=scientific,
        )

    grouped_plot(summary,"Fehler_%_Mittelwert","Mittlere normalisierte Abweichung (%)",outdir,"02_Aufgaben_Normalisiert")

    if len(overall):

        fig,ax=plt.subplots(figsize=(7,5));v=[overall[m].values for m in METHODS]

        ax.boxplot(v, tick_labels=[METHOD_LABELS[m] for m in METHODS],
                   showmeans=True, showfliers=False)
        # Alle persönlichen Durchschnittsfehler sichtbar machen. Die kleinen,
        # reproduzierbaren horizontalen Versätze verhindern Punktüberlagerungen.
        for i, values in enumerate(v, start=1):
            ordered = np.argsort(values, kind="stable")
            offsets = np.empty(len(values))
            offsets[ordered] = np.linspace(-0.09, 0.09, len(values))
            ax.scatter(i + offsets, values, s=24, color=COLORS[METHODS[i-1]],
                       edgecolors="white", linewidths=0.4, alpha=0.85, zorder=3)

        ax.set_ylabel("Durchschnittliche normalisierte Abweichung (%)");ax.spines[["top","right"]].set_visible(False)

        save_plot(fig,outdir,"03_Boxplot_Verteilung_individueller_Durchschnittsfehler")

        fig,ax=plt.subplots(figsize=(7,5))

        bars=ax.bar([METHOD_LABELS[m] for m in METHODS],[overall_ranks.set_index("Methode").loc[m,"Anteil_Erstplatz_%"] for m in METHODS],color=[COLORS[m] for m in METHODS])

        ax.bar_label(bars,fmt="%.1f",padding=3);ax.set_ylabel("Personen mit geringstem Durchschnittsfehler (%)");ax.set_ylim(0,105)

        ax.spines[["top","right"]].set_visible(False);save_plot(fig,outdir,"04_Erstplatz_Anteile")

        fig,ax=plt.subplots(figsize=(7,5));bars=ax.bar([METHOD_LABELS[m] for m in METHODS],[overall[m].mean() for m in METHODS],color=[COLORS[m] for m in METHODS])

        ax.bar_label(bars,fmt="%.2f",padding=3);ax.set_ylabel("Mittlere normalisierte Abweichung (%)");ax.set_ylim(bottom=0)

        ax.spines[["top","right"]].set_visible(False);save_plot(fig,outdir,"05_Durchschnittlicher_normalisierter_Fehler")

    print(f"Teilnehmende (Filter): {n_participants}; gültige Einzelantworten: {len(valid)}/{len(trials)}")

    print(f"Vollständige Aufgaben-Tripel: {len(triples)}; vollständige Personen (12 Aufgaben): {len(overall)}")

    print("Hinweis: 'Exakt' bedeutet hier numerisch identisch (Toleranz 1e-10); 1%-Toleranz separat.")

    print(f"Dateien: {outdir}")





def no_flag_summary(noflag, original_people):

    """Explorative Sensitivität: gleiche ursprüngliche Personengruppe, markierte Werte entfernt.

    Personen mit danach unvollständigen Aufgaben werden nicht mit wechselnden Aufgabenmitteln vermischt.

    """

    w=noflag[noflag.Teilnehmer.isin(original_people)].pivot(index=["Teilnehmer","Aufgabe"],columns="Methode",values="Fehler_%").reindex(columns=METHODS).dropna()

    n=w.reset_index().groupby("Teilnehmer")["Aufgabe"].nunique() if len(w) else pd.Series(dtype=int)

    ids=n[n==len(TASKS)].index

    w=w.loc[w.index.get_level_values("Teilnehmer").isin(ids)]

    w=w.groupby(level="Teilnehmer").mean() if len(w) else pd.DataFrame(columns=METHODS)

    return pd.DataFrame([{"Methode":m,"n_Personen_ohne_markierte":len(w),

                          "Mittelwert_ohne_markierte":w[m].mean() if len(w) else np.nan} for m in METHODS])





if __name__ == "__main__":

    main()
