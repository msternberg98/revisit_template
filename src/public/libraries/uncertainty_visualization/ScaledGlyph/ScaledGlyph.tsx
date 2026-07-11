import { useEffect, useRef } from "react";
import { drawScaledGlyph, ScaledGlyphOptions } from "./drawScaledGlyph";

interface ScaledGlyphProps {
    parameters?: {
        preset?: "precipitation" | "temperature" | "air_pressure";
        output?: ScaledGlyphOptions ["output"];
    };
}


export default function ScaledGlyph ({ parameters }: ScaledGlyphProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawScaledGlyph (container.current!, {preset: parameters?.preset, output: parameters?.output, onClickPoint: (result) => {

                console.log ("Klick auf Punkt:", result);
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