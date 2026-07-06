import { useEffect, useRef } from "react";
import { drawVSUP } from "./drawVSUP";

console.log("VSUP module loaded");

export default function VSUP() {

    console.log("VSUP component rendered");

    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {

        console.log("useEffect");

        if (!container.current) return;

        console.log("calling drawVSUP");

        drawVSUP(container.current);

        console.log("drawVSUP finished");

    }, []);

    return (
        <div
            ref={container}
            style={{
                width: "100%",
                height: "100%"
            }}
        />
    );
}