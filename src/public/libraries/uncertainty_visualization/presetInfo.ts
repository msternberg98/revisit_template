import { DatasetPreset, PresetInfo } from "./types";

export const presetInfo: Record <DatasetPreset, PresetInfo> = {

    test1: {

        valueKey: "mean_temperature",
        factor: 1,
        decimals: 1,
        uncertainty_decimals: 2,
        valueLabel: "Temperatur",
        uncertaintyLabel: "Standardabweichung",
        unit: "°C",
        datasetName: "Test"
    },

    test2: {

        valueKey: "mean_temperature",
        factor: 1,
        decimals: 1,
        uncertainty_decimals: 2,
        valueLabel: "Temperatur",
        uncertaintyLabel: "Standardabweichung",
        unit: "°C",
        datasetName: "Test"
    },

    test3: {

        valueKey: "mean_temperature",
        factor: 1,
        decimals: 1,
        uncertainty_decimals: 2,
        valueLabel: "Temperatur",
        uncertaintyLabel: "Standardabweichung",
        unit: "°C",
        datasetName: "Test"
    },

    temperature: {

        valueKey: "mean_temperature",
        factor: 1,
        decimals: 1,
        uncertainty_decimals: 2,
        valueLabel: "Temperatur",
        uncertaintyLabel: "Standardabweichung",
        unit: "°C",
        datasetName: "Temperature"
    },

    precipitation: {

        valueKey: "mean_precipitation",
        factor: 86400,
        decimals: 1,
        uncertainty_decimals: 2,
        valueLabel: "Niederschlag",
        uncertaintyLabel: "Standardabweichung",
        unit: "mm/Tag",
        datasetName: "Precipitation"
    },

    air_pressure: {

        valueKey: "mean_air_pressure",
        factor: 0.01,
        decimals: 0,
        uncertainty_decimals: 0,
        valueLabel: "Luftdruck",
        uncertaintyLabel: "Standardabweichung",
        unit: "hPa",
        datasetName: "Air_Pressure"
    }
};