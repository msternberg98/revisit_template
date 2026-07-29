import * as d3 from "d3";
import { ClimateData } from "./types";

export type DatasetPreset =
    | "empty"
    | "test1"
    | "test2"
    | "test3"
    | "temperature"
    | "precipitation"
    | "air_pressure";

const datasetPaths: Record <DatasetPreset, string> = {
    empty:
        "/Nutzerstudie/Assets/Data/empty.csv",

    test1:
        "/Nutzerstudie/Assets/Data/test1.csv",

    test2:
        "/Nutzerstudie/Assets/Data/test2.csv",

    test3:
        "/Nutzerstudie/Assets/Data/test3.csv",

    temperature:
        "/Nutzerstudie/Assets/Data/temperature_max_std_range.csv",

    precipitation:
        "/Nutzerstudie/Assets/Data/precipitation_min_mean_range.csv",

    air_pressure:
        "/Nutzerstudie/Assets/Data/air_pressure_max_std_range.csv",
};

export async function loadDataset (preset: DatasetPreset): Promise<ClimateData []> {

    return d3.csv (datasetPaths [preset], (d): ClimateData => {

        const row: ClimateData = {
            longitude: +d.longitude!,
            latitude: +d.latitude!,
            uncertainty_std: +d.uncertainty_std!
            };

            switch (preset) {

                case "empty":
                    row.mean_temperature = +d.mean_temperature!;
                    break;


                case "test1":
                    row.mean_temperature = +d.mean_temperature!;
                    break;

                case "test2":
                    row.mean_temperature = +d.mean_temperature!;
                    break;

                case "test3":
                    row.mean_temperature = +d.mean_temperature!;
                    break;

                case "temperature":
                    row.mean_temperature = +d.mean_temperature!;
                    break;

                case "precipitation":
                    row.mean_precipitation = +d.mean_precipitation!;
                    break;

                case "air_pressure":
                    row.mean_air_pressure = +d.mean_air_pressure!;
                    break;
            }

            return row;
        }
    );
}