import * as d3 from "d3";

export type DatasetPreset =
    | "precipitation"
    | "temperature"
    | "air_pressure";

const datasetPaths: Record <DatasetPreset, string> = {
    precipitation:
        "/libraries/uncertainty_visualization/Data/precipitation_min_mean_range.csv",

    temperature:
        "/libraries/uncertainty_visualization/Data/max_std_range.csv",

    air_pressure:
        "/libraries/uncertainty_visualization/Data/air_pressure_max_std_range.csv",
};

export async function loadDataset (preset: DatasetPreset) {

    const data = await d3.csv (
        datasetPaths [preset],
        d3.autoType
    );

    return data;
}