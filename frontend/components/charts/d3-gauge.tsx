"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";

type D3GaugeProps = {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  tone?: "emerald" | "amber" | "rose" | "blue" | "auto";
  /** If true, renders 3 color zones: emerald → amber → rose (or reversed) */
  zones?: "health" | "risk" | "rul";
  subtitle?: string;
};

function getZoneColor(value: number, max: number, zones?: D3GaugeProps["zones"]): string {
  const pct = (value / max) * 100;
  if (zones === "health") {
    if (pct <= 35) return "#f43f5e";
    if (pct <= 70) return "#f59e0b";
    return "#10b981";
  }
  if (zones === "risk") {
    if (pct >= 70) return "#f43f5e";
    if (pct >= 35) return "#f59e0b";
    return "#10b981";
  }
  if (zones === "rul") {
    if (pct <= 25) return "#f43f5e";
    if (pct <= 55) return "#f59e0b";
    return "#10b981";
  }
  return "#3ba6f1";
}

const toneColors = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3ba6f1",
  auto: "#3ba6f1",
};

export function D3Gauge({
  value,
  max = 100,
  label = "Health Score",
  unit = "%",
  tone = "blue",
  zones,
  subtitle,
}: D3GaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const normalizedValue = Math.max(0, Math.min(value, max));

  const fillColor = zones
    ? getZoneColor(normalizedValue, max, zones)
    : toneColors[tone];

  const displayValue = useMemo(() => {
    if (Number.isInteger(normalizedValue)) return String(normalizedValue);
    return normalizedValue.toFixed(1);
  }, [normalizedValue]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 220;
    const height = 140;
    const radius = 88;
    const centerX = width / 2;
    const centerY = 118;
    const arcWidth = 14;

    const scale = d3.scaleLinear().domain([0, max]).range([-Math.PI / 2, Math.PI / 2]);

    const arcGen = d3
      .arc<d3.DefaultArcObject>()
      .innerRadius(radius - arcWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .cornerRadius(arcWidth / 2);

    const group = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", `${label}: ${displayValue}${unit}`)
      .append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    // Track arc
    group
      .append("path")
      .datum({ endAngle: Math.PI / 2 } as d3.DefaultArcObject)
      .attr("d", arcGen)
      .attr("fill", "#e5e7eb");

    // Zone segments if zones mode
    if (zones) {
      const zoneDefinitions = zones === "health"
        ? [
            { from: 0, to: 35, color: "#f43f5e" },
            { from: 35, to: 70, color: "#f59e0b" },
            { from: 70, to: max, color: "#10b981" },
          ]
        : zones === "risk"
          ? [
              { from: 0, to: 35, color: "#10b981" },
              { from: 35, to: 70, color: "#f59e0b" },
              { from: 70, to: max, color: "#f43f5e" },
            ]
          : [
              { from: 0, to: max * 0.25, color: "#f43f5e" },
              { from: max * 0.25, to: max * 0.55, color: "#f59e0b" },
              { from: max * 0.55, to: max, color: "#10b981" },
            ];

      for (const zone of zoneDefinitions) {
        const clampedFrom = Math.max(0, Math.min(normalizedValue, zone.to));
        const clampedTo = Math.min(normalizedValue, zone.to);
        if (clampedTo > zone.from) {
          const zoneArc = d3
            .arc<d3.DefaultArcObject>()
            .innerRadius(radius - arcWidth)
            .outerRadius(radius)
            .startAngle(scale(zone.from))
            .cornerRadius(2);

          group
            .append("path")
            .datum({ endAngle: scale(clampedTo) } as d3.DefaultArcObject)
            .attr("d", zoneArc)
            .attr("fill", zone.color)
            .attr("opacity", 0.9);
        }
      }
    } else {
      // Single color fill
      group
        .append("path")
        .datum({ endAngle: scale(normalizedValue) } as d3.DefaultArcObject)
        .attr("d", arcGen)
        .attr("fill", fillColor);
    }

    // Needle
    const needleAngle = scale(normalizedValue) - Math.PI / 2;
    group
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", Math.cos(needleAngle) * (radius - arcWidth - 6))
      .attr("y2", Math.sin(needleAngle) * (radius - arcWidth - 6))
      .attr("stroke", "#0c0a09")
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round");

    group.append("circle").attr("r", 5).attr("fill", "#0c0a09");
  }, [displayValue, fillColor, label, max, normalizedValue, unit, zones]);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg ref={svgRef} className="w-full max-w-[220px]" style={{ height: 140 }} />
      <div className="-mt-6 text-center">
        <p
          className="text-[30px] font-medium leading-tight"
          style={{ color: "var(--color-slate-text)", letterSpacing: "-0.02em" }}
        >
          {displayValue}
          <span className="ml-1 text-sm font-normal" style={{ color: "var(--color-ash-gray)" }}>
            {unit}
          </span>
        </p>
        <p
          className="mt-0.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--color-ash-gray)" }}
        >
          {label}
        </p>
        {subtitle && (
          <p className="mt-1 text-[12px]" style={{ color: fillColor, fontWeight: 500 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
