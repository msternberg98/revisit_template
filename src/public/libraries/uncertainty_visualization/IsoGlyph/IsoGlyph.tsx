import { useEffect, useRef } from "react";
import { drawIsoGlyph, IsoGlyphOptions } from "./drawIsoGlyph";

interface IsoGlyphProps {
    parameters?: {
        preset?: "test" | "temperature" | "precipitation" | "air_pressure";
        output?: IsoGlyphOptions ["output"];
    };

    setAnswer?: (value: {

        status: boolean;
        answers: Record <string, number>;
        provenanceGraph?: unknown;
    }) => void;
}


export default function IsoGlyph ({ parameters, setAnswer }: IsoGlyphProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawIsoGlyph (container.current!, {preset: parameters?.preset, output: parameters?.output, onClickPoint: (result) => {
        
                console.log ("Klick auf Punkt:", result);
                setAnswer?.({status: true, answers: {
        
                    IsoGlyph_Response_Latitude: result.latitude,
                    IsoGlyph_Response_Longitude: result.longitude,
                    IsoGlyph_Response_Value: result.meanValue,
                    IsoGlyph_Response_Uncertainty: result.uncertaintyStd,
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