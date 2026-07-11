import * as d3 from "d3";
import { ClimateData } from "./types";

export function shiftedLongitude (lon: number): number {
    let shifted = lon - 30;

    if (shifted > 180) shifted -= 360;

    return shifted;
}

export function unshiftedLongitude (shiftedLon: number): number {

    let lon = shiftedLon + 30;

    if (lon < 0) lon += 360;

    if (lon >= 360) lon -= 360;

    return lon;

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