import { useEffect, useRef } from "react";
import { drawScaledGlyph, ScaledGlyphOptions } from "./drawScaledGlyph_SVG";

interface ScaledGlyphProps {
    parameters?: {
        preset?: "test1" | "test2" | "test3" | "temperature" | "precipitation" | "air_pressure";
        output?: ScaledGlyphOptions ["output"];
    };

    setAnswer?: (value: {

        status: boolean;
        answers: Record <string, number>;
        provenanceGraph?: unknown;
    }) => void;
}


export default function ScaledGlyph ({ parameters, setAnswer }: ScaledGlyphProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawScaledGlyph (container.current!, {preset: parameters?.preset, output: parameters?.output, onClickPoint: (result) => {

                // console.log ("Klick auf Punkt:", result);
                setAnswer?.({status: true, answers: {

                    ScaledGlyph_Response_Latitude: result.latitude,
                    ScaledGlyph_Response_Longitude: result.longitude,
                    ScaledGlyph_Response_Value: result.meanValue,
                    ScaledGlyph_Response_Uncertainty: result.uncertaintyStd,
                },});
            }});
        };

        load ();

    }, [parameters]);

    return (
        <div
            ref = {container}
            style = {{
                width: "100%",
                height: "100%"
            }}
        />
    );
}