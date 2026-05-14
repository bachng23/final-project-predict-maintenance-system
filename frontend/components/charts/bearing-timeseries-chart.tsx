"use client";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TelemetryPoint } from "@/lib/backend-api";

type BearingTimeseriesChartProps = {
  points: TelemetryPoint[];
  emptyMessage?: string;
};

function formatAxisTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatTooltipLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BearingTimeseriesChart({
  points,
  emptyMessage = "No prediction history returned from the backend yet.",
}: BearingTimeseriesChartProps) {
  const annotatedPoints = points.filter((point) => point.faultType && point.faultType !== "normal");

  if (!points.length) {
    return <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <ResponsiveContainer height={360} width="100%">
      <ComposedChart data={points} margin={{ top: 12, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="timestamp"
          minTickGap={28}
          stroke="#94a3b8"
          tick={{ fontSize: 10 }}
          tickFormatter={formatAxisTime}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          stroke="#94a3b8"
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => `${Math.round(value)}%`}
          tickLine={false}
          yAxisId="score"
        />
        <YAxis
          orientation="right"
          stroke="#94a3b8"
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => `${Math.round(value)}h`}
          tickLine={false}
          yAxisId="rul"
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
          formatter={(value, name) => {
            const number = Number(value ?? 0);
            if (name === "Health Score" || name === "Failure Probability") return [`${number.toFixed(1)}%`, name as string];
            if (name === "RUL") return [`${number.toFixed(1)} hr`, name as string];
            return [String(value ?? ""), name as string];
          }}
          labelFormatter={(label) => formatTooltipLabel(String(label))}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

        <Area dataKey="rulUpper" fill="#34d399" fillOpacity={0.08} legendType="none" stroke="none" yAxisId="rul" />
        <Area dataKey="rulLower" fill="#0f172a" fillOpacity={1} legendType="none" stroke="none" yAxisId="rul" />

        <Line dataKey="healthScore" dot={false} isAnimationActive={false} name="Health Score" stroke="#38bdf8" strokeWidth={2.25} yAxisId="score" />
        <Line
          dataKey="failureProbability"
          dot={false}
          isAnimationActive={false}
          name="Failure Probability"
          stroke="#fb7185"
          strokeWidth={2.25}
          yAxisId="score"
        />
        <Line dataKey="rul" dot={false} isAnimationActive={false} name="RUL" stroke="#34d399" strokeWidth={2.5} yAxisId="rul" />

        {annotatedPoints.map((point) => (
          <ReferenceDot
            key={`${point.timestamp}-${point.fileIdx ?? "x"}`}
            fill="#f59e0b"
            label={{ fill: "#f59e0b", fontSize: 9, position: "top", value: point.faultType }}
            r={4}
            stroke="#fff"
            strokeWidth={1}
            x={point.timestamp}
            y={point.failureProbability}
            yAxisId="score"
          />
        ))}

        <Brush dataKey="timestamp" fill="#0f172a" height={24} stroke="#334155" tickFormatter={formatAxisTime} travellerWidth={8} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
