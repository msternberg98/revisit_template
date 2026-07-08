import * as d3 from "d3";
import { ClimateData } from "./types";

export function shiftedLongitude (lon: number): number {
    let shifted = lon - 30;

    if (shifted > 180) shifted -= 360;

    return shifted;
}

export function createScales (
    data: ClimateData [],
    width: number,
    height: number
) {

    const xScale = d3.scaleLinear ()
        .domain (d3.extent (data, d => shiftedLongitude (d.longitude)) as [number, number])
        .range ([0, width]);

    const yScale = d3.scaleLinear ()
        .domain (d3.extent (data, d => d.latitude) as [number, number])
        .range ([height, 0]);

    return { xScale, yScale };
}