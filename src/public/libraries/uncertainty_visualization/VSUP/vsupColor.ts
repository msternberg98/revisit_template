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
    const normalized = (value - valueExtent [0]) / (valueExtent [1] - valueExtent [0]);

    if (useDiscrete) {

        const availableBins = Math.max (2, valueSteps - Math.round (uncertaintyLevel));
        const quantized = Math.floor (normalized * availableBins) / (availableBins - 1);
        const base = d3.interpolateViridis (quantized);
        const blend = uncertaintyLevel / (uncertaintySteps - 1);

        return d3.interpolateRgb (base, "#d9d9d9") (blend * 0.9);

    } else {

        const uncertainty_normalized = uncertaintyLevel / (uncertaintySteps - 1);
        const compressedValue = 0.5 + (normalized - 0.5) * (1 - uncertainty_normalized);
        const base = d3.interpolateViridis (compressedValue);

        return d3.interpolateRgb (base, "#d9d9d9")(uncertainty_normalized);
    }
}