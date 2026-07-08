import { useEffect, useRef } from "react";
import { drawVSUP, VSUPOptions } from "./drawVSUP";

interface VSUPProps {
    parameters?: {
        preset?: "precipitation" | "temperature" | "air_pressure";
        output?: VSUPOptions ["output"];
    };
}


export default function VSUP ({ parameters }: VSUPProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawVSUP (container.current!, {preset: parameters?.preset, output: parameters?.output});
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