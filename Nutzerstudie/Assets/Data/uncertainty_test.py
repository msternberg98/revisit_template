from pathlib import Path
import pandas as pd

script_dir = Path (__file__).resolve ().parent
csv_path = script_dir / "temperature_min_std_range.csv"
output_path = script_dir / "test1.csv"
# output_path = script_dir / "test2.csv"
# output_path = script_dir / "test3.csv"
df = pd.read_csv (csv_path)

# Test 1
lat_min, lat_max = -48, -42
lon_min, lon_max = 335, 346
# Test2
# lat_min, lat_max = 15, 21
# lon_min, lon_max = 50, 61
# Test 3
# lat_min, lat_max = 51, 56
# lon_min, lon_max = 322, 333

mask = (

    (df ["latitude"] >= lat_min) &
    (df ["latitude"] <= lat_max) &
    (df ["longitude"] >= lon_min) &
    (df ["longitude"] <= lon_max)
)

df.loc [mask, "uncertainty_std"] = 4

df.to_csv (output_path, index = False)
print (f"Neue Datei gespeichert unter: {output_path}")