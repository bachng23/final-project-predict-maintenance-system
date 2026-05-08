"use client";

import { useEffect, useRef, useState } from "react";
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
import type { RULPoint } from "@/hooks/useRULStream";

const WINDOW = 40; // default number of points visible in the brush window

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

  // Track whether user has manually dragged the brush
  const userPanned = useRef(false);
  const [brushRange, setBrushRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: WINDOW - 1,
  });

  // Auto-follow latest data unless user has panned away
  useEffect(() => {
    if (points.length === 0) return;
    if (userPanned.current) return;

    const end = points.length - 1;
    const start = Math.max(0, end - WINDOW + 1);
    setBrushRange({ start, end });
  }, [points.length]);

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex === undefined || range.endIndex === undefined) return;

    // If user dragged to the very end, resume auto-follow
    const atEnd = range.endIndex >= points.length - 1;
    userPanned.current = !atEnd;

    setBrushRange({ start: range.startIndex, end: range.endIndex });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`} />
        {connected ? "Live — WebSocket connected" : "Waiting for connection…"}

        {userPanned.current && (
          <button
            className="ml-1 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400 hover:border-slate-400 hover:text-slate-200"
            onClick={() => {
              userPanned.current = false;
              const end = points.length - 1;
              setBrushRange({ start: Math.max(0, end - WINDOW + 1), end });
            }}
          >
            ↓ Jump to latest
          </button>
        )}

        <span className="ml-auto text-slate-500">{points.length} samples</span>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
          No live data yet. Start a demo or connect a bearing stream.
        </div>
      ) : (
        <ResponsiveContainer height={420} width="100%">
          <ComposedChart data={points} margin={{ bottom: 4, left: -10, right: 8, top: 8 }}>
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
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tickLine={false}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              yAxisId="pfail"
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
              formatter={(val, name) => {
                const n = typeof val === "number" ? val : 0;
                if (name === "RUL") return [fmt(n), "RUL"];
                if (name === "P(fail)") return [`${(n * 100).toFixed(1)}%`, "P(fail)"];
                return [val, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

            {/* CI band */}
            <Area dataKey="rulUpper" fill="#34d399" fillOpacity={0.08} legendType="none" name="CI upper" stroke="none" yAxisId="rul" />
            <Area dataKey="rulLower" fill="#0f172a" fillOpacity={1} legendType="none" name="CI lower" stroke="none" yAxisId="rul" />

            {/* RUL line */}
            <Line dataKey="rulMinutes" dot={false} isAnimationActive={false} name="RUL" stroke="#34d399" strokeWidth={2.5} yAxisId="rul" />

            {/* P(fail) line */}
            <Line dataKey="pFail" dot={false} isAnimationActive={false} name="P(fail)" stroke="#fb7185" strokeWidth={2} yAxisId="pfail" />

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

            {/* Pan/zoom brush */}
            <Brush
              dataKey="fileIdx"
              endIndex={brushRange.end}
              fill="#0f172a"
              height={24}
              startIndex={brushRange.start}
              stroke="#334155"
              travellerWidth={8}
              onChange={handleBrushChange}
            >
              {/* Minimap: faint RUL line inside brush */}
              <ComposedChart>
                <Line dataKey="rulMinutes" dot={false} isAnimationActive={false} stroke="#34d399" strokeOpacity={0.5} strokeWidth={1} yAxisId="rul" />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
