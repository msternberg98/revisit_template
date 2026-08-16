import * as d3 from "d3";

export interface VSUPColorOptions {

    value: number;
    uncertainty: number;

    valueExtent: [number, number];
    uncertaintyScale: (u: number) => number;

    valueSteps: number;
    uncertaintySteps: number;

    useDiscrete: boolean;
}

export function vsupColor ({
    value,
    uncertainty,
    valueExtent,
    uncertaintyScale,
    valueSteps,
    uncertaintySteps,
    useDiscrete
}: VSUPColorOptions): string {

    const uncertaintyLevel = uncertaintyScale (uncertainty);

    const availableBins = Math.max (2, valueSteps - Math.round (uncertaintyLevel));

    const normalized = (value - valueExtent [0]) / (valueExtent [1] - valueExtent [0]);

    const quantized = useDiscrete
        ? Math.floor (normalized * availableBins) / (availableBins - 1)
        : normalized;

    const base = d3.interpolateViridis (quantized);

    const blend = uncertaintyLevel / (uncertaintySteps - 1);

    return d3.interpolateRgb (base, "#d9d9d9") (blend * 0.9);
}