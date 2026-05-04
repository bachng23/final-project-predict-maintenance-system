"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";

type D3GaugeProps = {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  tone?: "emerald" | "amber" | "rose" | "blue";
};

const toneColors = {
  emerald: { fill: "#10b981", track: "#064e3b", text: "#a7f3d0" },
  amber: { fill: "#f59e0b", track: "#78350f", text: "#fde68a" },
  rose: { fill: "#f43f5e", track: "#881337", text: "#fecdd3" },
  blue: { fill: "#38bdf8", track: "#0c4a6e", text: "#bae6fd" },
};

export function D3Gauge({ value, max = 100, label, unit = "%", tone = "emerald" }: D3GaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const normalizedValue = Math.max(0, Math.min(value, max));
  const colors = toneColors[tone];

  const displayValue = useMemo(() => {
    if (Number.isInteger(normalizedValue)) return String(normalizedValue);
    return normalizedValue.toFixed(1);
  }, [normalizedValue]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 260;
    const height = 168;
    const radius = 105;
    const centerX = width / 2;
    const centerY = 136;
    const scale = d3.scaleLinear().domain([0, max]).range([-Math.PI / 2, Math.PI / 2]);

    const arc = d3
      .arc<d3.DefaultArcObject>()
      .innerRadius(radius - 18)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .cornerRadius(12);

    const group = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", `${label}: ${displayValue}${unit}`)
      .append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    group
      .append("path")
      .datum({ endAngle: Math.PI / 2 } as d3.DefaultArcObject)
      .attr("d", arc)
      .attr("fill", colors.track)
      .attr("opacity", 0.58);

    group
      .append("path")
      .datum({ endAngle: scale(normalizedValue) } as d3.DefaultArcObject)
      .attr("d", arc)
      .attr("fill", colors.fill)
      .attr("filter", "drop-shadow(0 0 12px rgba(56, 189, 248, 0.22))");

    const tickGroup = group.append("g");
    d3.range(0, max + 1, max / 4).forEach((tick) => {
      const angle = scale(tick);
      const inner = radius - 4;
      const outer = radius + 7;
      tickGroup
        .append("line")
        .attr("x1", Math.cos(angle - Math.PI / 2) * inner)
        .attr("y1", Math.sin(angle - Math.PI / 2) * inner)
        .attr("x2", Math.cos(angle - Math.PI / 2) * outer)
        .attr("y2", Math.sin(angle - Math.PI / 2) * outer)
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1)
        .attr("opacity", 0.45);
    });

    const needleAngle = scale(normalizedValue) - Math.PI / 2;
    group
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", Math.cos(needleAngle) * (radius - 32))
      .attr("y2", Math.sin(needleAngle) * (radius - 32))
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");

    group.append("circle").attr("r", 7).attr("fill", "#e2e8f0");
  }, [colors, displayValue, label, max, normalizedValue, unit]);

  return (
    <div className="flex h-full min-h-[196px] flex-col items-center justify-center">
      <svg ref={svgRef} className="h-40 w-full max-w-[260px]" />
      <div className="-mt-8 text-center">
        <p className="font-headline text-3xl font-bold text-white">
          {displayValue}
          <span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span>
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.text }}>
          {label}
        </p>
      </div>
    </div>
  );
}
