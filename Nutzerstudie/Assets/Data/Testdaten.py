from pathlib import Path
import pandas as pd

script_dir = Path (__file__).resolve ().parent

# Raster
lat_values = range (10)
lon_values = range (10)

test1 = [
        [0, 0, 0, 0, 0, 0, 0, 5, 5, 5],
        [0, 0, 0, 0, 0, 0, 0, 5, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 5, 5, 5],
        [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0, 3, 0],
    ]

test3 = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 5, 5, 5, 0, 0, 0, 0, 0, 0],
        [0, 5, 10, 5, 0, 0, 0, 0, 1, 0],
        [0, 5, 5, 5, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 2, 0, 0, 0, 0, 0, 0, 0, 3],
        [2, 2, 0, 0, 0, 0, 0, 0, 3, 3],
    ]

test2 = [
        [0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [2, 2, 0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 5, 5, 5, 0, 0, 0, 0],
        [0, 0, 0, 5, 10, 5, 0, 0, 0, 0],
        [0, 0, 0, 5, 5, 5, 0, 0, 0, 0],
    ]

uncertainties = {
    "test1" : test1,
    "test2" : test2,
    "test3" : test3,
}

for name, uncertainty in uncertainties.items ():

    data = []

    for i, lat in enumerate (lat_values):
        for j, lon in enumerate (lon_values):

            data.append({

                "latitude": lat,
                "longitude": lon,
                "mean_temperature": 15,
                "uncertainty_std": uncertainty [i][j]
            })

    df = pd.DataFrame (data)

    df.to_csv (script_dir / f"{name}.csv", index = False)

    print (f"{name}_neu.csv gespeichert.")