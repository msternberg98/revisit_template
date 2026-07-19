from pathlib import Path
import pandas as pd

script_dir = Path (__file__).resolve ().parent
csv_path = script_dir / "temperature_max_std_range.csv"
df = pd.read_csv (csv_path)

regions = [
    {
        "name": "R1",
        "latitudeMin": 77.4058880820788,
        "latitudeMax": 84.86197029204237,
        "longitudeMin": 9.375,
        "longitudeMax": 16.875
    },
    {
        "name": "R2",
        "latitudeMin": 49.42915369712305,
        "latitudeMax": 56.89001260135711,
        "longitudeMin": 22.5,
        "longitudeMax": 30
    },
    {
        "name": "R3",
        "latitudeMin": 41.96822026907538,
        "latitudeMax": 49.42915369712305,
        "longitudeMin": 296.25,
        "longitudeMax": 303.75
    },
    {
        "name": "R4",
        "latitudeMin": -84.86197029204237,
        "latitudeMax": -77.4058880820788,
        "longitudeMin": 275.625,
        "longitudeMax": 283.125
    },
    {
        "name": "R5",
        "latitudeMin": 49.42915369712305,
        "latitudeMax": 56.89001260135711,
        "longitudeMin": 166.875,
        "longitudeMax": 174.375
    }
]

# Mittelwerte berechnen
for region in regions:

    selection = df[
        (df ["latitude"] >= region ["latitudeMin"]) &
        (df ["latitude"] <= region ["latitudeMax"]) &
        (df ["longitude"] >= region ["longitudeMin"]) &
        (df ["longitude"] <= region ["longitudeMax"])
    ]

    print (f" {region ['name']}:")
    print (f"  Anzahl Punkte: {len (selection)}")
    print (f"  Mean Temperature: {selection ['mean_temperature'].mean ():.4f}")
    print (f"  Mean Uncertainty: {selection ['uncertainty_std'].mean ():.4f}")
    print ()