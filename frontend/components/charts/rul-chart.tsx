"use client";

import {
  Area,
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
import type { RULPoint } from "@/hooks/useRULStream";

interface Props {
  points: RULPoint[];
  connected: boolean;
}

function fmt(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

export function RULChart({ connected, points }: Props) {
  const anomalyPoints = points.filter((p) => p.anomaly);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`} />
        {connected ? "Live — WebSocket connected" : "Waiting for connection…"}
        <span className="ml-auto text-slate-500">{points.length} samples</span>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[380px] items-center justify-center text-sm text-slate-500">
          No live data yet. Start a demo or connect a bearing stream.
        </div>
      ) : (
        <ResponsiveContainer height={380} width="100%">
          <ComposedChart data={points} margin={{ bottom: 8, left: -10, right: 8, top: 8 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="fileIdx" minTickGap={20} stroke="#94a3b8" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis
              domain={["auto", "auto"]}
              label={{ angle: -90, fill: "#94a3b8", fontSize: 10, position: "insideLeft", value: "RUL (min)" }}
              stroke="#94a3b8"
              tick={{ fontSize: 10 }}
              tickLine={false}
              yAxisId="rul"
            />
            <YAxis
              domain={[0, 1]}
              orientation="right"
              stroke="#94a3b8"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tickLine={false}
              yAxisId="pfail"
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
              formatter={(val, name) => {
                const n = typeof val === 'number' ? val : 0;
                if (name === "RUL") return [fmt(n), "RUL"];
                if (name === "P(fail)") return [`${(n * 100).toFixed(1)}%`, "P(fail)"];
                return [val, name];
              }}
            />
            <Legend />

            {/* CI band */}
            <Area
              dataKey="rulUpper"
              fill="#34d399"
              fillOpacity={0.08}
              legendType="none"
              name="CI upper"
              stroke="none"
              yAxisId="rul"
            />
            <Area
              dataKey="rulLower"
              fill="#0f172a"
              fillOpacity={1}
              legendType="none"
              name="CI lower"
              stroke="none"
              yAxisId="rul"
            />

            {/* RUL line */}
            <Line
              dataKey="rulMinutes"
              dot={false}
              name="RUL"
              stroke="#34d399"
              strokeWidth={2.5}
              yAxisId="rul"
            />

            {/* P(fail) line */}
            <Line
              dataKey="pFail"
              dot={false}
              name="P(fail)"
              stroke="#fb7185"
              strokeWidth={2}
              yAxisId="pfail"
            />

            {/* Anomaly markers */}
            {anomalyPoints.map((p) => (
              <ReferenceDot
                key={p.fileIdx}
                fill="#f97316"
                label={{ fill: "#f97316", fontSize: 9, position: "top", value: "⚠" }}
                r={5}
                stroke="#fff"
                strokeWidth={1}
                x={p.fileIdx}
                y={p.rulMinutes}
                yAxisId="rul"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
