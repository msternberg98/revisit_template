import * as d3 from "d3";
import { ClimateData } from "./types";

export type DatasetPreset =
    | "precipitation"
    | "temperature"
    | "air_pressure";

const datasetPaths: Record <DatasetPreset, string> = {
    precipitation:
        //"/libraries/uncertainty_visualization/Data/precipitation_min_mean_range.csv",
        "/Nutzerstudie/Assets/Data/precipitation_min_mean_range.csv",

    temperature:
        //"/libraries/uncertainty_visualization/Data/max_std_range.csv",
        "/Nutzerstudie/Assets/Data/temperature_max_std_range.csv",

    air_pressure:
        //"/libraries/uncertainty_visualization/Data/air_pressure_max_std_range.csv",
        "/Nutzerstudie/Assets/Data/air_pressure_max_std_range.csv",
};

export async function loadDataset (preset: DatasetPreset): Promise<ClimateData []> {

    return d3.csv (datasetPaths [preset], (d): ClimateData => {
//
//        return d3.csv (datasetPaths [preset], (d) => {
//
//        console.log(d);
//
//        return {
//            longitude: +d.longitude!,
//            latitude: +d.latitude!,
//
//            mean_temperature: +d.mean_temperature!,
//            mean_precipitation: +d.mean_precipitation!,
//            mean_air_pressure: +d.mean_air_pressure!,
//
//            uncertainty_std: +d.uncertainty_std!
//        };
//    });

        const row: ClimateData = {
            longitude: +d.longitude!,
            latitude: +d.latitude!,
            uncertainty_std: +d.uncertainty_std!
            };

            switch (preset) {

                case "precipitation":
                    row.mean_precipitation = +d.mean_precipitation!;
                    break;

                case "temperature":
                    row.mean_temperature = +d.mean_temperature!;
                    break;

                case "air_pressure":
                    row.mean_air_pressure = +d.mean_air_pressure!;
                    break;
            }

            return row;
        }
    );
}