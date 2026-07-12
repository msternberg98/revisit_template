import { DatasetPreset, PresetInfo } from "./types";

export const presetInfo: Record <DatasetPreset, PresetInfo> = {

    test: {

        valueKey: "mean_temperature",

        factor: 1,

        decimals: 1,

        uncertainty_decimals: 2,

        valueLabel: "Temperatur",

        uncertaintyLabel: "Standardabweichung",

        unit: "°C"
    },

    temperature: {

        valueKey: "mean_temperature",

        factor: 1,

        decimals: 1,

        uncertainty_decimals: 2,

        valueLabel: "Temperatur",

        uncertaintyLabel: "Standardabweichung",

        unit: "°C"
    },

    precipitation: {

        valueKey: "mean_precipitation",

        factor: 86400,

        decimals: 1,

        uncertainty_decimals: 2,

        valueLabel: "Niederschlag",

        uncertaintyLabel: "Standardabweichung",

        unit: "mm/Tag"
    },

    air_pressure: {

        valueKey: "mean_air_pressure",

        factor: 0.01,

        decimals: 0,

        uncertainty_decimals: 0,

        valueLabel: "Luftdruck",

        uncertaintyLabel: "Standardabweichung",

        unit: "hPa"
    }
};