import { useEffect, useRef } from "react";
import * as d3 from "d3";

type ZoomableSVGProps = {

  width: number;
  height: number;
  children: React.ReactNode;
};

export default function ZoomableSVG({

  width,
  height,
  children,

}: ZoomableSVGProps) {

  const svgRef = useRef <SVGSVGElement | null> (null);
  const zoomGroupRef = useRef <SVGGElement | null> (null);

  useEffect(() => {

    if (!svgRef.current || !zoomGroupRef.current) return;

    const svg = d3.select (svgRef.current);
    const g = d3.select (zoomGroupRef.current);
    const zoom = d3.zoom <SVGSVGElement, unknown> ()
      .scaleExtent ([1, 20])
      .on ("zoom", (event) => {g.attr ("transform", event.transform);});

    svg.call (zoom);

    return () => {svg.on (".zoom", null);};
  }, []);

  return (

    <svg

      ref = {svgRef}
      viewBox = {`0 0 ${width} ${height}`}
      style = {{ width: "100%", height: "auto" }}

    >

      <g ref = {zoomGroupRef}>{children}</g>

    </svg>
  );
}