import { useEffect, useRef } from "react";
import { drawVSUP } from "./drawVSUP";


export default function VSUP() {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef(false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawVSUP(container.current!);
        };

        load ();

    }, []);

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