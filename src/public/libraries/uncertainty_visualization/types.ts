export interface ClimateData {

    longitude: number;
    latitude: number;

    mean_temperature?: number;
    mean_precipitation?: number;
    mean_air_pressure?: number;

    uncertainty_std: number;
}

export type DatasetPreset =
    | "test1"
    | "test2"
    | "test3"
    | "temperature"
    | "precipitation"
    | "air_pressure";

export interface PresetInfo {

    valueKey:
        | "mean_temperature"
        | "mean_precipitation"
        | "mean_air_pressure";

    factor: number;

    decimals: number;

    uncertainty_decimals: number;

    valueLabel: string;

    uncertaintyLabel: string;

    unit: string;

    datasetName: string;
}