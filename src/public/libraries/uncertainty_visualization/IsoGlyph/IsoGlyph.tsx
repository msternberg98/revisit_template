import { useEffect, useRef } from "react";
import { drawIsoGlyph, IsoGlyphOptions } from "./drawIsoGlyph";

interface IsoGlyphProps {
    parameters?: {
        preset?: "test" | "temperature" | "precipitation" | "air_pressure";
        output?: IsoGlyphOptions ["output"];
    };
}


export default function IsoGlyph ({ parameters }: IsoGlyphProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawIsoGlyph (container.current!, {preset: parameters?.preset, output: parameters?.output, onClickPoint: (result) => {

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