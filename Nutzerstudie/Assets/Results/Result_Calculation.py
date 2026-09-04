#!/usr/bin/env python3
"""
Auswertung der Nutzerstudie "Visualisierung von Unsicherheiten in 2D-Daten"

Nutzung:
- Diese .py-Datei in denselben Ordner wie die Ergebnis-CSV legen.
- In Visual Studio Code öffnen und ausführen.
- Standardmäßig wird automatisch die erste passende CSV im selben Ordner gesucht.
- Die Ergebnisse werden als CSV und zusätzlich gesammelt als XLSX im Unterordner "analysis_output" gespeichert.

WICHTIG:
- Antwort -999 = nicht beantwortet.
- -999 wird als fehlende Antwort behandelt und NICHT als Ausreißer oder Fehlerwert.
- Es findet keine automatische Ausreißerentfernung statt.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.anova import AnovaRM


# ---------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------

METHOD_ORDER = ["VSUP", "ScaledGlyph", "IsoGlyph"]

# ---------------------------------------------------------------------
# Ergebnisdatei auswählen
# ---------------------------------------------------------------------
# Hier wird festgelegt, welche CSV ausgewertet wird.
# Zum Wechseln zwischen Test-, Pilot- und Finaldaten einfach genau EINE
# der folgenden Zeilen aktiv lassen bzw. den Dateinamen anpassen.

CSV_FILENAME = "Nutzerstudie_all_tidy_Test.csv"       # aktuelle Testdaten
# CSV_FILENAME = "Nutzerstudie_all_tidy_Pilot.csv"  # spätere Pilotstudie
# CSV_FILENAME = "Nutzerstudie_all_tidy_Final.csv"  # spätere Hauptstudie

OUTPUT_FOLDER = "analysis_output"

# Standardmäßig nur vollständig abgeschlossene Teilnehmende analysieren.
INCLUDE_INCOMPLETE = False

# Definition einer "exakten" Antwort
#
# "exact" ist ausschließlich eine DESKRIPTIVE Zusatzkennzahl, z.B.
# "VSUP: 5/20 exakt". Sie geht NICHT in ANOVA, t-Test, Friedman oder
# Wilcoxon ein. Die inferenzstatistischen Tests verwenden weiterhin
# ausschließlich die metrische absolute Abweichung abs_error.
#
# Eine Antwort gilt als exakt, wenn ihre absolute Abweichung vom
# tatsächlichen Extremwert höchstens 1 % der gesamten Wertspanne
# der jeweiligen Variable beträgt.
EXACT_PERCENTAGE = 0.01


# Tatsächliche Werte der Regionen.
# "deviation" = absolute Abweichung vom Zielwert -12 °C.
REGION_VALUES = {
    "VSUP": {
        "R1": {
            "temperature_mean": -13.1901063,
            "deviation_from_target": 1.1901063,
            "uncertainty": 5.4355829,
        },
        "R2": {
            "temperature_mean": -1.23907347408,
            "deviation_from_target": 10.76092652592,
            "uncertainty": 3.135608284,
        },
        "R3": {
            "temperature_mean": 0.46065072160,
            "deviation_from_target": 12.46065072160,
            "uncertainty": 1.4988802804,
        },
        "R4": {
            "temperature_mean": -20.09617172000,
            "deviation_from_target": 8.09617172000,
            "uncertainty": 1.429650956,
        },
        "R5": {
            "temperature_mean": 2.70402026400,
            "deviation_from_target": 14.70402026400,
            "uncertainty": 0.6453833008,
        },
    },
    "ScaledGlyph": {
        "R1": {
            "temperature_mean": -13.324312746,
            "deviation_from_target": 1.324312746,
            "uncertainty": 5.06290306,
        },
        "R2": {
            "temperature_mean": -0.9009721432,
            "deviation_from_target": 11.0990278568,
            "uncertainty": 3.080212368,
        },
        "R3": {
            "temperature_mean": 0.619351364,
            "deviation_from_target": 12.619351364,
            "uncertainty": 1.5227066124,
        },
        "R4": {
            "temperature_mean": -19.99693754000,
            "deviation_from_target": 7.99693754000,
            "uncertainty": 1.455844682,
        },
        "R5": {
            "temperature_mean": 2.77247876000,
            "deviation_from_target": 14.77247876000,
            "uncertainty": 0.650520978,
        },
    },
    "IsoGlyph": {
        "R1": {
            "temperature_mean": -13.1901063,
            "deviation_from_target": 1.1901063,
            "uncertainty": 5.4355829,
        },
        "R2": {
            "temperature_mean": -0.94865091016,
            "deviation_from_target": 11.05134908984,
            "uncertainty": 3.129501516,
        },
        "R3": {
            "temperature_mean": 0.58398272800,
            "deviation_from_target": 12.58398272800,
            "uncertainty": 1.5260805704,
        },
        "R4": {
            "temperature_mean": -3.604896392,
            "deviation_from_target": 8.395103608,
            "uncertainty": 1.424277884,
        },
        "R5": {
            "temperature_mean": 2.78459602000,
            "deviation_from_target": 14.78459602000,
            "uncertainty": 0.6421452136,
        },
    },
}


H1_TRIAL_RE = re.compile(
    r"^(Niederschlag_Uncertainty_(?:Maxima|Minima)|"
    r"Luftdruck_Value_(?:Maxima|Minima))_"
    r"(VSUP|ScaledGlyph|IsoGlyph)$"
)

REGION_TRIALS = {
    "Temperatur_Regions_VSUP": "VSUP",
    "Temperatur_Regions_ScaledGlyph": "ScaledGlyph",
    "Temperatur_Regions_IsoGlyph": "IsoGlyph",
}

REGION_CHOICE_PROMPT = "Welche Region würden Sie wählen?"
REGION_TEXT_PROMPT = "Wieso haben Sie sich für diese Region entschieden?"
CONFIDENCE_PROMPT = "Wie sicher sind Sie sich mit Ihrer Antwort?"
GENERAL_COMMENT_PROMPT = "Weitere Anmerkungen"


# ---------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------

def numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def find_csv(script_dir: Path) -> Path:
    if CSV_FILENAME:
        p = script_dir / CSV_FILENAME
        if not p.exists():
            raise FileNotFoundError(f"CSV nicht gefunden: {p}")
        return p

    candidates = [
        p for p in script_dir.glob("*.csv")
        if not p.name.startswith(("h1_", "h2_", "text_", "missing_"))
        and "analysis_output" not in str(p)
    ]

    # tidy-Dateien bevorzugen
    tidy = [p for p in candidates if "tidy" in p.name.lower()]
    if len(tidy) == 1:
        return tidy[0]

    if len(tidy) > 1:
        raise RuntimeError(
            "Mehrere tidy-CSV-Dateien gefunden:\n"
            + "\n".join(f"  - {p.name}" for p in tidy)
            + "\nBitte oben CSV_FILENAME setzen."
        )

    if len(candidates) == 1:
        return candidates[0]

    if not candidates:
        raise FileNotFoundError(
            "Keine Ergebnis-CSV im selben Ordner wie die .py-Datei gefunden."
        )

    raise RuntimeError(
        "Mehrere CSV-Dateien gefunden:\n"
        + "\n".join(f"  - {p.name}" for p in candidates)
        + "\nBitte oben CSV_FILENAME setzen."
    )


def completed_participants(df: pd.DataFrame) -> set[str]:
    pc = numeric(df["percentComplete"])
    max_pc = df.assign(_pc=pc).groupby("participantId")["_pc"].max()
    return set(max_pc[max_pc >= 100].index.astype(str))


def prepare_base(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["participantId"] = out["participantId"].astype(str)

    if not INCLUDE_INCOMPLETE:
        keep = completed_participants(out)
        out = out[out["participantId"].isin(keep)].copy()

    return out


# ---------------------------------------------------------------------
# Forschungsfrage 1: Extrema / Wahrnehmung
# ---------------------------------------------------------------------

def h1_variable_from_task(task: str) -> str:
    """
    Ordnet die vier Extrema-Aufgaben ihrer jeweiligen Variable zu.
    Maxima und Minima derselben Variable erhalten dadurch dieselbe
    prozentuale Exaktheits-Toleranz.
    """
    if str(task).startswith("Niederschlag_Uncertainty_"):
        return "Niederschlag_Uncertainty"
    if str(task).startswith("Luftdruck_Value_"):
        return "Luftdruck_Value"
    return str(task)


def apply_automatic_exact_tolerance(h1: pd.DataFrame) -> pd.DataFrame:
    """
    Berechnet für jede Variable:
        Toleranz = EXACT_PERCENTAGE * (korrektes Maximum - korrektes Minimum)

    Die korrekten Extrema werden direkt aus correctAnswer der Studie abgeleitet.
    Die Kennzahl 'exact' bleibt rein deskriptiv und beeinflusst keinen Test.
    """
    if h1.empty:
        return h1

    out = h1.copy()
    out["variable"] = out["task"].map(h1_variable_from_task)

    ranges = (
        out.groupby("variable")["correctAnswer"]
        .agg(correct_min="min", correct_max="max")
        .reset_index()
    )
    ranges["value_range"] = ranges["correct_max"] - ranges["correct_min"]
    ranges["exact_tolerance"] = ranges["value_range"] * EXACT_PERCENTAGE

    out = out.drop(columns=["exact_tolerance", "exact"], errors="ignore").merge(
        ranges[
            [
                "variable",
                "correct_min",
                "correct_max",
                "value_range",
                "exact_tolerance",
            ]
        ],
        on="variable",
        how="left",
    )

    exact = out["abs_error"] <= out["exact_tolerance"]
    exact[
        out["abs_error"].isna()
        | out["exact_tolerance"].isna()
        | (out["value_range"] <= 0)
    ] = pd.NA
    out["exact"] = exact.astype("boolean")

    return out


def exact_tolerance_summary(h1: pd.DataFrame) -> pd.DataFrame:
    """Dokumentiert die automatisch verwendeten 1%-Toleranzen."""
    if h1.empty or "variable" not in h1.columns:
        return pd.DataFrame()

    cols = [
        "variable",
        "correct_min",
        "correct_max",
        "value_range",
        "exact_tolerance",
    ]
    result = h1[cols].drop_duplicates().copy()
    result["exact_percentage"] = EXACT_PERCENTAGE
    return result.sort_values("variable").reset_index(drop=True)


def build_h1(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    cand = df[df["status"].eq("completed")].copy()

    for _, r in cand.iterrows():
        tid = str(r.get("trialId", ""))
        m = H1_TRIAL_RE.match(tid)
        if not m:
            continue

        task, method = m.groups()

        correct = pd.to_numeric(
            pd.Series([r.get("correctAnswer")]),
            errors="coerce"
        ).iloc[0]

        # Nur die eigentliche Klickantwort analysieren.
        # Zeilen wie subjektive Sicherheit besitzen keinen numerischen correctAnswer.
        if pd.isna(correct):
            continue

        answer = pd.to_numeric(
            pd.Series([r.get("answer")]),
            errors="coerce"
        ).iloc[0]

        unanswered = pd.isna(answer) or answer == -999

        if unanswered:
            answer = np.nan
            abs_error = np.nan
        else:
            abs_error = abs(float(answer) - float(correct))

        # Die Toleranz für "exakt" wird erst nach dem Einlesen aller
        # H1-Aufgaben automatisch aus 1 % der Variablenspanne berechnet.
        tolerance = np.nan
        exact = pd.NA

        duration_clean = pd.to_numeric(
            pd.Series([r.get("cleanedDuration")]), errors="coerce"
        ).iloc[0]

        duration_raw = pd.to_numeric(
            pd.Series([r.get("duration")]), errors="coerce"
        ).iloc[0]

        rows.append(
            {
                "participantId": str(r["participantId"]),
                "task": task,
                "visualization": method,
                "answer": answer,
                "correctAnswer": float(correct),
                "abs_error": abs_error,
                "answered": not unanswered,
                "exact_tolerance": tolerance,
                "exact": exact,
                "duration_ms": (
                    duration_clean
                    if pd.notna(duration_clean)
                    else duration_raw
                ),
                "trialId": tid,
                "trialOrder": r.get("trialOrder"),
            }
        )

    h1 = pd.DataFrame(rows)
    if not h1.empty:
        h1 = apply_automatic_exact_tolerance(h1)
    return h1


def h1_complete_triplets(h1: pd.DataFrame) -> pd.DataFrame:
    answered = h1[h1["answered"]].copy()

    counts = (
        answered.groupby(["participantId", "task"])["visualization"]
        .nunique()
        .rename("n_methods")
        .reset_index()
    )

    complete = counts[
        counts["n_methods"] == len(METHOD_ORDER)
    ][["participantId", "task"]]

    return answered.merge(
        complete,
        on=["participantId", "task"],
        how="inner"
    )


def participant_method_aggregate(paired_h1: pd.DataFrame) -> pd.DataFrame:
    if paired_h1.empty:
        return pd.DataFrame()

    agg = (
        paired_h1.groupby(
            ["participantId", "visualization"],
            as_index=False
        )
        .agg(
            mean_abs_error=("abs_error", "mean"),
            median_abs_error=("abs_error", "median"),
            mean_duration_ms=("duration_ms", "mean"),
            n_tasks=("task", "nunique"),
        )
    )

    exact_source = paired_h1.dropna(subset=["exact"])

    if not exact_source.empty:
        ex = (
            exact_source.groupby(
                ["participantId", "visualization"],
                as_index=False
            )
            .agg(exact_rate=("exact", "mean"))
        )
        agg = agg.merge(
            ex,
            on=["participantId", "visualization"],
            how="left"
        )

    return agg


def h1_summary(h1: pd.DataFrame) -> pd.DataFrame:
    if h1.empty:
        return pd.DataFrame()

    grouped = (
        h1.groupby("visualization", as_index=False)
        .agg(
            n_trials=("trialId", "size"),
            n_answered=("answered", "sum"),
            mean_abs_error=("abs_error", "mean"),
            median_abs_error=("abs_error", "median"),
            mean_duration_ms=("duration_ms", "mean"),
            median_duration_ms=("duration_ms", "median"),
        )
    )

    grouped["answer_rate"] = (
        grouped["n_answered"] / grouped["n_trials"]
    )

    if h1["exact"].notna().any():
        ex_source = h1.dropna(subset=["exact"]).copy()
        ex_source["exact_int"] = ex_source["exact"].astype(int)

        ex = (
            ex_source
            .groupby("visualization", as_index=False)
            .agg(
                n_exact=("exact_int", "sum"),
                n_exact_evaluable=("exact_int", "size"),
                exact_rate=("exact_int", "mean"),
            )
        )
        ex["exact_display"] = (
            ex["n_exact"].astype(str)
            + "/"
            + ex["n_exact_evaluable"].astype(str)
        )

        grouped = grouped.merge(ex, on="visualization", how="left")

    return grouped


# ---------------------------------------------------------------------
# Statistische Tests
# ---------------------------------------------------------------------
#
# Erwarteter Hauptpfad:
# Bei annähernd normalverteilten paarweisen Differenzen:
#   Repeated-Measures-ANOVA -> bei Signifikanz gepaarte t-Tests
#
# Fallback bei verletzter Normalitätsannahme:
#   Friedman-Test -> bei Signifikanz Wilcoxon-Tests
#
# Die Entscheidung wird nicht vorab erzwungen, sondern anhand der Daten
# dokumentiert. So bleibt die Analyse auch für Pilot- und Finaldaten robust.

def normality_of_pairwise_differences(
    wide: pd.DataFrame,
    methods: list[str]
) -> pd.DataFrame:
    rows = []

    for i in range(len(methods)):
        for j in range(i + 1, len(methods)):
            a, b = methods[i], methods[j]
            pair = wide[[a, b]].dropna()
            diff = pair[a] - pair[b]

            if len(diff) >= 3:
                w, p = stats.shapiro(diff)
            else:
                w, p = np.nan, np.nan

            rows.append(
                {
                    "comparison": f"{a} - {b}",
                    "n": len(diff),
                    "shapiro_W": w,
                    "shapiro_p": p,
                    "normal_at_0.05": (
                        bool(p >= 0.05)
                        if pd.notna(p)
                        else pd.NA
                    ),
                }
            )

    return pd.DataFrame(rows)


def omnibus_and_posthoc(
    long_df: pd.DataFrame,
    value_col: str,
    subject_col: str = "participantId",
    method_col: str = "visualization",
):
    x = long_df[
        [subject_col, method_col, value_col]
    ].dropna().copy()

    wide = x.pivot_table(
        index=subject_col,
        columns=method_col,
        values=value_col,
        aggfunc="mean",
    )

    methods = [m for m in METHOD_ORDER if m in wide.columns]
    wide = wide[methods].dropna()

    if len(methods) != 3 or len(wide) < 3:
        note = pd.DataFrame(
            [{
                "test": "nicht berechnet",
                "n_complete_participants": len(wide),
                "statistic": np.nan,
                "df": np.nan,
                "p": np.nan,
                "significant_0.05": pd.NA,
                "note": (
                    "Zu wenige vollständige Fälle oder "
                    "nicht alle drei Methoden vorhanden."
                ),
            }]
        )
        return pd.DataFrame(), note, pd.DataFrame()

    normality = normality_of_pairwise_differences(wide, methods)
    all_normal = normality["normal_at_0.05"].fillna(False).all()

    if all_normal:
        long_complete = (
            wide.reset_index()
            .melt(
                id_vars=subject_col,
                var_name=method_col,
                value_name=value_col,
            )
        )

        model = AnovaRM(
            long_complete,
            depvar=value_col,
            subject=subject_col,
            within=[method_col],
        ).fit()

        table = model.anova_table.reset_index()

        omnibus = pd.DataFrame(
            [{
                "test": "Repeated Measures ANOVA",
                "n_complete_participants": len(wide),
                "statistic": float(table.loc[0, "F Value"]),
                "df": (
                    f"{float(table.loc[0, 'Num DF']):.0f}, "
                    f"{float(table.loc[0, 'Den DF']):.0f}"
                ),
                "p": float(table.loc[0, "Pr > F"]),
                "significant_0.05": bool(
                    table.loc[0, "Pr > F"] < 0.05
                ),
                "note": (
                    "Verwendet, weil alle paarweisen Differenzen "
                    "Shapiro p >= .05 hatten."
                ),
            }]
        )
        posthoc_type = "paired t-test"

    else:
        vals = [wide[m].to_numpy() for m in methods]
        stat, p = stats.friedmanchisquare(*vals)

        omnibus = pd.DataFrame(
            [{
                "test": "Friedman-Test",
                "n_complete_participants": len(wide),
                "statistic": float(stat),
                "df": len(methods) - 1,
                "p": float(p),
                "significant_0.05": bool(p < 0.05),
                "note": (
                    "Verwendet, weil mindestens eine paarweise "
                    "Differenz Shapiro p < .05 hatte."
                ),
            }]
        )
        posthoc_type = "Wilcoxon signed-rank"

    if not bool(omnibus.loc[0, "significant_0.05"]):
        posthoc = pd.DataFrame(
            [{
                "test": posthoc_type,
                "comparison": "nicht durchgeführt",
                "n": len(wide),
                "statistic": np.nan,
                "p_raw": np.nan,
                "p_bonferroni": np.nan,
                "significant_bonferroni_0.05": pd.NA,
                "note": "Omnibustest nicht signifikant.",
            }]
        )
        return normality, omnibus, posthoc

    rows = []
    n_comp = math.comb(len(methods), 2)

    for i in range(len(methods)):
        for j in range(i + 1, len(methods)):
            a, b = methods[i], methods[j]
            xa, xb = wide[a], wide[b]

            if posthoc_type == "paired t-test":
                stat, p = stats.ttest_rel(
                    xa,
                    xb,
                    nan_policy="omit"
                )
            else:
                d = xa - xb
                if np.allclose(d, 0):
                    stat, p = 0.0, 1.0
                else:
                    stat, p = stats.wilcoxon(
                        xa,
                        xb,
                        zero_method="wilcox"
                    )

            p_bonf = min(float(p) * n_comp, 1.0)

            rows.append(
                {
                    "test": posthoc_type,
                    "comparison": f"{a} vs {b}",
                    "n": len(xa),
                    "statistic": float(stat),
                    "p_raw": float(p),
                    "p_bonferroni": p_bonf,
                    "significant_bonferroni_0.05": (
                        p_bonf < 0.05
                    ),
                    "note": (
                        f"Bonferroni über {n_comp} Vergleiche; "
                        f"äquivalent alpha={0.05/n_comp:.4f}."
                    ),
                }
            )

    return normality, omnibus, pd.DataFrame(rows)


# ---------------------------------------------------------------------
# Forschungsfrage 2: Regionsentscheidung
# ---------------------------------------------------------------------

def extract_region_data(df: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for pid, psub in df.groupby("participantId"):
        for tid, method in REGION_TRIALS.items():
            sub = psub[
                (psub["trialId"] == tid)
                & (psub["status"] == "completed")
            ]

            if sub.empty:
                continue

            def one_answer(prompt: str):
                s = sub.loc[
                    sub["responsePrompt"] == prompt,
                    "answer"
                ].dropna()
                return s.iloc[0] if len(s) else np.nan

            choice = one_answer(REGION_CHOICE_PROMPT)
            justification = one_answer(REGION_TEXT_PROMPT)
            confidence = one_answer(CONFIDENCE_PROMPT)

            dur = numeric(sub["cleanedDuration"]).dropna()
            if dur.empty:
                dur = numeric(sub["duration"]).dropna()

            rows.append(
                {
                    "participantId": str(pid),
                    "visualization": method,
                    "region": choice,
                    "justification": justification,
                    "confidence": pd.to_numeric(
                        pd.Series([confidence]),
                        errors="coerce"
                    ).iloc[0],
                    "duration_ms": (
                        dur.iloc[0]
                        if len(dur)
                        else np.nan
                    ),
                    "trialId": tid,
                }
            )

    return pd.DataFrame(rows)


def enrich_regions(region: pd.DataFrame) -> pd.DataFrame:
    x = region.copy()

    means = []
    deviations = []
    uncertainties = []
    safest = []

    for _, r in x.iterrows():
        method = r["visualization"]
        region_name = r["region"]

        values = REGION_VALUES.get(method, {}).get(
            str(region_name),
            None
        )

        if values is None:
            means.append(np.nan)
            deviations.append(np.nan)
            uncertainties.append(np.nan)
            safest.append(pd.NA)
            continue

        mean_v = values["temperature_mean"]
        dev_v = values["deviation_from_target"]
        unc_v = values["uncertainty"]

        method_uncertainties = {
            rr: vv["uncertainty"]
            for rr, vv in REGION_VALUES[method].items()
        }
        min_unc = min(method_uncertainties.values())

        means.append(mean_v)
        deviations.append(dev_v)
        uncertainties.append(unc_v)
        safest.append(bool(np.isclose(unc_v, min_unc)))

    x["chosen_temperature_mean"] = means
    x["deviation_from_target"] = deviations
    x["chosen_uncertainty"] = uncertainties
    x["is_safest_region"] = pd.Series(
        safest,
        dtype="boolean"
    )

    return x


def region_summaries(region: pd.DataFrame):
    freq = (
        region.groupby(
            ["visualization", "region"],
            dropna=False
        )
        .size()
        .rename("n")
        .reset_index()
    )

    freq["proportion_within_method"] = (
        freq.groupby("visualization")["n"]
        .transform(lambda s: s / s.sum())
    )

    summary = (
        region.groupby("visualization", as_index=False)
        .agg(
            n_choices=("region", "count"),
            mean_chosen_uncertainty=(
                "chosen_uncertainty",
                "mean"
            ),
            median_chosen_uncertainty=(
                "chosen_uncertainty",
                "median"
            ),
            mean_deviation_from_target=(
                "deviation_from_target",
                "mean"
            ),
            median_deviation_from_target=(
                "deviation_from_target",
                "median"
            ),
            mean_confidence=("confidence", "mean"),
            median_confidence=("confidence", "median"),
            mean_duration_ms=("duration_ms", "mean"),
            median_duration_ms=("duration_ms", "median"),
        )
    )

    safest = (
        region.dropna(subset=["is_safest_region"])
        .groupby("visualization", as_index=False)
        .agg(
            safest_region_rate=("is_safest_region", "mean"),
            n_safest_evaluable=("is_safest_region", "size"),
        )
    )

    summary = summary.merge(
        safest,
        on="visualization",
        how="left"
    )

    return freq, summary


# ---------------------------------------------------------------------
# Freitext
# ---------------------------------------------------------------------

def build_text_outputs(
    df: pd.DataFrame,
    region: pd.DataFrame
) -> pd.DataFrame:
    rows = []

    for _, r in region.iterrows():
        text = r.get("justification")

        if pd.notna(text) and str(text).strip():
            rows.append(
                {
                    "task": "Temperatur – Standortentscheidung",
                    "visualization": r["visualization"],
                    "participantId": r["participantId"],
                    "selected_answer": r.get("region"),
                    "text": str(text).strip(),
                }
            )

    comments = df[
        (df["trialId"] == "Feedback")
        & (df["status"] == "completed")
        & (df["responsePrompt"] == GENERAL_COMMENT_PROMPT)
    ]

    for _, r in comments.iterrows():
        text = r.get("answer")

        if pd.notna(text) and str(text).strip():
            rows.append(
                {
                    "task": "Abschlussfeedback – Weitere Anmerkungen",
                    "visualization": "",
                    "participantId": str(r["participantId"]),
                    "selected_answer": "",
                    "text": str(text).strip(),
                }
            )

    out = pd.DataFrame(rows)

    if not out.empty:
        order_map = {
            "VSUP": 0,
            "ScaledGlyph": 1,
            "IsoGlyph": 2,
            "": 3,
        }
        out["_method_order"] = (
            out["visualization"]
            .map(order_map)
            .fillna(99)
        )

        out = (
            out.sort_values(
                [
                    "task",
                    "_method_order",
                    "participantId"
                ]
            )
            .drop(columns="_method_order")
            .reset_index(drop=True)
        )

    return out


def write_text_markdown(
    text_df: pd.DataFrame,
    path: Path
) -> None:
    with path.open("w", encoding="utf-8") as f:
        f.write("# Freitextantworten nach Aufgabe\n\n")

        if text_df.empty:
            f.write("Keine Freitextantworten gefunden.\n")
            return

        for task, tsub in text_df.groupby(
            "task",
            sort=False
        ):
            f.write(f"## {task}\n\n")

            for method, msub in tsub.groupby(
                "visualization",
                sort=False,
                dropna=False
            ):
                if str(method).strip():
                    f.write(f"### {method}\n\n")

                for _, r in msub.iterrows():
                    prefix = f"**{r['participantId']}**"

                    selected = str(
                        r["selected_answer"]
                    ).strip()

                    if selected and selected != "nan":
                        prefix += (
                            f" — Auswahl: **{selected}**"
                        )

                    f.write(prefix + "\n\n")
                    f.write(str(r["text"]).strip() + "\n\n")
                    f.write("---\n\n")


def write_missing_report(
    h1: pd.DataFrame,
    region: pd.DataFrame,
    path: Path
) -> None:
    miss_h1 = h1[
        ~h1["answered"]
    ][
        [
            "participantId",
            "task",
            "visualization",
            "trialId"
        ]
    ].copy()

    miss_h1["type"] = (
        "Extrema-Klick nicht beantwortet (-999/NaN)"
    )

    miss_region = region[
        region["region"].isna()
    ][
        [
            "participantId",
            "visualization",
            "trialId"
        ]
    ].copy()

    miss_region["task"] = (
        "Temperatur – Standortentscheidung"
    )
    miss_region["type"] = (
        "Region nicht ausgewählt"
    )

    cols = [
        "participantId",
        "task",
        "visualization",
        "trialId",
        "type",
    ]

    all_missing = pd.concat(
        [
            miss_h1[cols],
            miss_region[cols]
        ],
        ignore_index=True
    )

    export_csv(all_missing, path)


# ---------------------------------------------------------------------
# Zusammenfassung der Testentscheidung
# ---------------------------------------------------------------------

def describe_test_decision(
    section_title: str,
    normality: pd.DataFrame,
    omnibus: pd.DataFrame,
    posthoc: pd.DataFrame,
) -> str:
    lines = [section_title]

    if omnibus.empty:
        lines.append("Keine Testentscheidung berechnet.")
        return "\n".join(lines)

    test_name = str(omnibus.iloc[0].get("test", "unbekannt"))
    lines.append(f"Verwendeter Omnibustest: {test_name}")

    if not normality.empty and "normal_at_0.05" in normality.columns:
        vals = normality["normal_at_0.05"].dropna()
        if len(vals):
            all_normal = bool(vals.all())
            lines.append(
                "Normalitätsannahme der paarweisen Differenzen erfüllt: "
                + ("Ja" if all_normal else "Nein")
            )

        lines.append("Shapiro-Wilk-Prüfungen der paarweisen Differenzen:")
        for _, r in normality.iterrows():
            p = r.get("shapiro_p", np.nan)
            p_text = f"{float(p):.6g}" if pd.notna(p) else "nicht berechnet"
            lines.append(
                f"  {r.get('comparison', '')}: p = {p_text}"
            )

    if "p" in omnibus.columns and pd.notna(omnibus.iloc[0].get("p")):
        p_omni = float(omnibus.iloc[0]["p"])
        lines.append(f"Omnibus-p-Wert: {p_omni:.6g}")
        lines.append(
            "Omnibustest signifikant (alpha=0,05): "
            + ("Ja" if p_omni < 0.05 else "Nein")
        )

    if "Repeated Measures ANOVA" in test_name:
        lines.append("Vorgesehener Post-hoc-Test bei Signifikanz: gepaarter t-Test")
    elif "Friedman" in test_name:
        lines.append("Vorgesehener Post-hoc-Test bei Signifikanz: Wilcoxon signed-rank")

    lines.append("Bonferroni-korrigiertes Alpha bei 3 Paarvergleichen: 0,0167")

    if not posthoc.empty:
        first_comp = str(posthoc.iloc[0].get("comparison", ""))
        if first_comp == "nicht durchgeführt":
            lines.append("Post-hoc-Tests: nicht durchgeführt, da Omnibustest nicht signifikant.")
        elif first_comp:
            lines.append("Post-hoc-Tests: durchgeführt.")

    return "\n".join(lines)


def write_analysis_decision(
    path: Path,
    h1_result,
    h1_duration_result,
    h2_uncertainty_result,
    h2_deviation_result,
) -> None:
    blocks = [
        describe_test_decision(
            "H1 – Genauigkeit / absolute Abweichung",
            *h1_result
        ),
        describe_test_decision(
            "H1 – Antwortzeit (sekundär)",
            *h1_duration_result
        ),
        describe_test_decision(
            "H2 – Unsicherheit der gewählten Region",
            *h2_uncertainty_result
        ),
        describe_test_decision(
            "H2 – Abweichung vom Zielwert -12 °C (zusätzlich)",
            *h2_deviation_result
        ),
    ]

    header = (
        "TESTENTSCHEIDUNGEN DER AUSWERTUNG\n"
        "================================\n\n"
        "Die Auswahl zwischen parametrischem und nichtparametrischem Pfad "
        "erfolgt anhand der Normalität der paarweisen Differenzen.\n"
        "Parametrischer Pfad: Repeated-Measures-ANOVA -> gepaarte t-Tests.\n"
        "Fallback: Friedman-Test -> Wilcoxon-Tests.\n\n"
    )

    path.write_text(
        header + "\n\n".join(blocks) + "\n",
        encoding="utf-8"
    )


# ---------------------------------------------------------------------
# Ausgabe: CSV + XLSX
# ---------------------------------------------------------------------

def export_csv(df: pd.DataFrame, path: Path) -> None:
    """
    CSV für deutsches Excel:
    - Semikolon als Trennzeichen
    - UTF-8 mit BOM, damit Umlaute und Gedankenstriche korrekt erkannt werden
    """
    df.to_csv(
        path,
        index=False,
        sep=";",
        encoding="utf-8-sig",
    )


def export_results_xlsx(
    path: Path,
    sheets: dict[str, pd.DataFrame],
) -> None:
    """
    Schreibt alle Auswertungstabellen zusätzlich in eine zentrale XLSX-Datei.
    Jedes Ergebnis erhält ein eigenes Tabellenblatt.
    """
    # xlsxwriter ist in vielen Anaconda-Installationen bereits enthalten.
    # Falls nicht, kann alternativ engine="openpyxl" verwendet werden.
    try:
        writer = pd.ExcelWriter(path, engine="xlsxwriter")
    except ModuleNotFoundError:
        writer = pd.ExcelWriter(path, engine="openpyxl")

    with writer:
        for sheet_name, df in sheets.items():
            # Excel erlaubt maximal 31 Zeichen pro Blattname.
            safe_name = sheet_name[:31]
            export_df = df.copy() if df is not None else pd.DataFrame()

            export_df.to_excel(
                writer,
                sheet_name=safe_name,
                index=False,
            )

            worksheet = writer.sheets[safe_name]

            # Formatierung für xlsxwriter.
            if writer.engine == "xlsxwriter":
                workbook = writer.book
                header_format = workbook.add_format({
                    "bold": True,
                    "text_wrap": True,
                    "valign": "top",
                    "border": 1,
                })
                text_format = workbook.add_format({
                    "text_wrap": True,
                    "valign": "top",
                })
                percent_format = workbook.add_format({
                    "num_format": "0.00%",
                })

                # Kopfzeile formatieren + Autofilter/Fixierung.
                for col_num, value in enumerate(export_df.columns):
                    worksheet.write(0, col_num, value, header_format)

                if len(export_df.columns) > 0:
                    worksheet.freeze_panes(1, 0)
                    worksheet.autofilter(
                        0, 0,
                        max(len(export_df), 1),
                        len(export_df.columns) - 1
                    )

                # Sinnvolle Spaltenbreiten anhand von Inhalt und Überschrift.
                for col_num, col in enumerate(export_df.columns):
                    # Erst in String umwandeln, dann fehlende Werte ersetzen.
                    # Das ist wichtig für pandas' nullable Boolean-Datentyp
                    # ("boolean" mit pd.NA), bei dem fillna("") sonst einen
                    # TypeError auslöst.
                    values = export_df[col].astype("string").fillna("")
                    max_len = max(
                        [len(str(col))]
                        + [len(v) for v in values.head(500)]
                    )

                    is_text_col = col in {
                        "text", "justification", "note", "type"
                    }
                    # Zusätzlicher Platz für den Excel-Filterpfeil in der
                    # Kopfzeile, damit Spaltennamen vollständig sichtbar sind.
                    width = min(
                        max(max_len + 5, 15),
                        70 if is_text_col else 36
                    )

                    fmt = text_format if is_text_col else None
                    if (
                        "rate" in col.lower()
                        or "proportion" in col.lower()
                    ):
                        fmt = percent_format

                    worksheet.set_column(
                        col_num, col_num, width, fmt
                    )

            # Einfache Formatierung für openpyxl-Fallback.
            else:
                worksheet.freeze_panes = "A2"
                worksheet.auto_filter.ref = worksheet.dimensions

                for column_cells in worksheet.columns:
                    max_length = 0
                    column_letter = column_cells[0].column_letter

                    for cell in column_cells[:501]:
                        if cell.value is not None:
                            max_length = max(
                                max_length,
                                len(str(cell.value))
                            )

                    worksheet.column_dimensions[column_letter].width = min(
                        max(max_length + 5, 15),
                        70
                    )


# ---------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------

def main():
    script_dir = Path(__file__).resolve().parent
    csv_path = find_csv(script_dir)

    output_dir = script_dir / OUTPUT_FOLDER
    output_dir.mkdir(exist_ok=True)

    print(f"CSV: {csv_path.name}")
    print(f"Ausgabeordner: {output_dir}\n")

    df = pd.read_csv(csv_path)
    base = prepare_base(df)

    # H1 ---------------------------------------------------------------
    h1 = build_h1(base)
    export_csv(
        h1,
        output_dir / "h1_extrema_trial_level.csv"
    )

    exact_tol = exact_tolerance_summary(h1)
    export_csv(
        exact_tol,
        output_dir / "h1_exact_tolerances.csv"
    )

    h1_sum = h1_summary(h1)
    export_csv(
        h1_sum,
        output_dir / "h1_summary_by_visualization.csv"
    )

    # Rein deskriptive Übersicht der exakten Antworten.
    # Diese Datei beeinflusst KEINEN inferenzstatistischen Test.
    exact_by_task = pd.DataFrame()
    if h1["exact"].notna().any():
        exact_source = h1.dropna(subset=["exact"]).copy()
        exact_source["exact_int"] = exact_source["exact"].astype(int)

        exact_by_task = (
            exact_source
            .groupby(["task", "visualization"], as_index=False)
            .agg(
                n_exact=("exact_int", "sum"),
                n_evaluable=("exact_int", "size"),
            )
        )
        exact_by_task["exact_rate"] = (
            exact_by_task["n_exact"] / exact_by_task["n_evaluable"]
        )
        exact_by_task["exact_display"] = (
            exact_by_task["n_exact"].astype(str)
            + "/"
            + exact_by_task["n_evaluable"].astype(str)
        )

        export_csv(
            exact_by_task,
            output_dir / "h1_exact_answers_descriptive.csv"
        )

    paired_h1 = h1_complete_triplets(h1)
    export_csv(
        paired_h1,
        output_dir / "h1_paired_task_level.csv"
    )

    pma = participant_method_aggregate(paired_h1)
    export_csv(
        pma,
        output_dir / "h1_participant_method.csv"
    )

    normality = pd.DataFrame()
    omnibus = pd.DataFrame()
    posthoc = pd.DataFrame()
    n_t = pd.DataFrame()
    o_t = pd.DataFrame()
    p_t = pd.DataFrame()

    h1_result = (normality, omnibus, posthoc)
    h1_duration_result = (n_t, o_t, p_t)

    if not pma.empty:
        normality, omnibus, posthoc = (
            omnibus_and_posthoc(
                pma,
                "mean_abs_error"
            )
        )
        h1_result = (normality, omnibus, posthoc)

        export_csv(
            normality,
            output_dir / "h1_normality_pairwise_differences.csv"
        )
        export_csv(
            omnibus,
            output_dir / "h1_omnibus_test.csv"
        )
        export_csv(
            posthoc,
            output_dir / "h1_posthoc_tests.csv"
        )

        # Sekundäre Leistungskennzahl Antwortzeit
        n_t, o_t, p_t = omnibus_and_posthoc(
            pma,
            "mean_duration_ms"
        )
        h1_duration_result = (n_t, o_t, p_t)

        export_csv(
            n_t,
            output_dir / "h1_duration_normality.csv"
        )
        export_csv(
            o_t,
            output_dir / "h1_duration_omnibus_test.csv"
        )
        export_csv(
            p_t,
            output_dir / "h1_duration_posthoc_tests.csv"
        )

    # H2 ---------------------------------------------------------------
    region = extract_region_data(base)
    region = enrich_regions(region)

    export_csv(
        region,
        output_dir / "h2_region_choices_long.csv"
    )

    freq, summary = region_summaries(region)

    export_csv(
        freq,
        output_dir / "h2_region_choice_frequencies.csv"
    )

    export_csv(
        summary,
        output_dir / "h2_summary_by_visualization.csv"
    )

    # Hauptmessgröße H2:
    # Unsicherheit der tatsächlich gewählten Region
    n_r, o_r, p_r = omnibus_and_posthoc(
        region,
        "chosen_uncertainty"
    )
    h2_uncertainty_result = (n_r, o_r, p_r)

    export_csv(
        n_r,
        output_dir / "h2_uncertainty_normality.csv"
    )
    export_csv(
        o_r,
        output_dir / "h2_uncertainty_omnibus_test.csv"
    )
    export_csv(
        p_r,
        output_dir / "h2_uncertainty_posthoc_tests.csv"
    )

    # Zusätzlich: Abweichung vom gewünschten Temperaturwert -12 °C
    n_d, o_d, p_d = omnibus_and_posthoc(
        region,
        "deviation_from_target"
    )
    h2_deviation_result = (n_d, o_d, p_d)

    export_csv(
        n_d,
        output_dir / "h2_deviation_normality.csv"
    )
    export_csv(
        o_d,
        output_dir / "h2_deviation_omnibus_test.csv"
    )
    export_csv(
        p_d,
        output_dir / "h2_deviation_posthoc_tests.csv"
    )

    # Freitext ---------------------------------------------------------
    text_df = build_text_outputs(base, region)

    export_csv(
        text_df,
        output_dir / "text_answers_by_task.csv"
    )

    write_text_markdown(
        text_df,
        output_dir /
        "text_answers_by_task.md"
    )

    write_missing_report(
        h1,
        region,
        output_dir /
        "missing_answers.csv"
    )

    write_analysis_decision(
        output_dir / "analysis_decision.txt",
        h1_result,
        h1_duration_result,
        h2_uncertainty_result,
        h2_deviation_result,
    )

    # Zentrale Excel-Arbeitsmappe mit allen Tabellen.
    # Leere Tabellenblätter sind bei den Testdaten erwartbar, wenn z.B.
    # für H1 keine gültigen Antworten vorhanden sind.
    workbook_sheets = {
        "H1 Übersicht": h1_sum,
        "H1 Einzelantworten": h1,
        "H1 Toleranzen": exact_tol,
        "H1 Exakt deskriptiv": exact_by_task,
        "H1 gepaarte Aufgaben": paired_h1,
        "H1 Teilnehmer Methoden": pma,
        "H1 Normalität": normality,
        "H1 Omnibustest": omnibus,
        "H1 Posthoc": posthoc,
        "H1 Zeit Normalität": n_t,
        "H1 Zeit Omnibus": o_t,
        "H1 Zeit Posthoc": p_t,
        "H2 Übersicht": summary,
        "H2 Regionsauswahl": region,
        "H2 Auswahlhäufigkeit": freq,
        "H2 Unsicherheit Normalität": n_r,
        "H2 Unsicherheit Omnibus": o_r,
        "H2 Unsicherheit Posthoc": p_r,
        "H2 Abweichung Normalität": n_d,
        "H2 Abweichung Omnibus": o_d,
        "H2 Abweichung Posthoc": p_d,
        "Freitext": text_df,
    }

    export_results_xlsx(
        output_dir / "00_Studienauswertung.xlsx",
        workbook_sheets,
    )

    # Kurze Konsolenausgabe -------------------------------------------
    print(
        f"Analysierte Teilnehmende: "
        f"{base['participantId'].nunique()}"
    )

    print(
        f"H1-Klickaufgaben: {len(h1)}"
    )

    if not h1.empty:
        print(
            f"  beantwortet: "
            f"{int(h1['answered'].sum())}"
        )
        print(
            f"  nicht beantwortet (-999/NaN): "
            f"{int((~h1['answered']).sum())}"
        )

    print(
        f"H2-Regionsentscheidungen: {len(region)}"
    )

    if not region.empty:
        print("\nSicherste Region je Visualisierung:")
        for method in METHOD_ORDER:
            values = REGION_VALUES[method]
            safest_region = min(
                values,
                key=lambda r: values[r]["uncertainty"]
            )
            unc = values[safest_region]["uncertainty"]
            print(
                f"  {method}: {safest_region} "
                f"(Unsicherheit {unc})"
            )

    print(
        f"\nExakte Antworten: Toleranz = {EXACT_PERCENTAGE * 100:.1f} % "
        "der jeweiligen Variablenspanne (rein deskriptiv)."
    )
    print(
        "Testentscheidung: siehe analysis_output/analysis_decision.txt"
    )

    print(
        "\nFertig. Alle Ergebnisdateien liegen in:"
    )
    print(output_dir)
    print("Excel-Gesamtübersicht: 00_Studienauswertung.xlsx")
    print("CSV-Dateien: Semikolon-getrennt und UTF-8-BOM für deutsches Excel")


if __name__ == "__main__":
    main()