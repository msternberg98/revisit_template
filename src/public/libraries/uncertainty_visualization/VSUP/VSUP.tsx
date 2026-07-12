import { useEffect, useRef } from "react";
import { drawVSUP, VSUPOptions } from "./drawVSUP";

interface VSUPProps {
    parameters?: {
        preset?: "test" | "temperature" | "precipitation" | "air_pressure";
        output?: VSUPOptions ["output"];
    };

    setAnswer?: (value: {

        status: boolean;
        answers: Record <string, number>;
        provenanceGraph?: unknown;
    }) => void;
}


export default function VSUP ({ parameters, setAnswer }: VSUPProps) {

    const container = useRef <HTMLDivElement> (null);
    const initialized = useRef (false);

    useEffect (() => {

        if (initialized.current) return;
        initialized.current = true;

        if (!container.current) return;

        const load = async () => {
            await drawVSUP (container.current!, {preset: parameters?.preset, output: parameters?.output, onClickPoint: (result) => {

                console.log ("Klick auf Punkt:", result);
                setAnswer?.({status: true, answers: {

                    VSUP_Response_Latitude: result.latitude,
                    VSUP_Response_Longitude: result.longitude,
                    VSUP_Response_Value: result.meanValue,
                    VSUP_Response_Uncertainty: result.uncertaintyStd,
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