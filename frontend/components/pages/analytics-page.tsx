"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { type DashboardData, fetchDashboard } from "@/lib/backend-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function failColor(p: number) {
  if (p >= 70) return "var(--color-rose)";
  if (p >= 35) return "var(--color-amber)";
  return "var(--color-emerald)";
}

const STATUS_COLORS: Record<string, string> = {
  Normal: "#10b981",
  Warning: "#f59e0b",
  Critical: "#f43f5e",
  Offline: "#a8a29e",
};

// ─── primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--color-cloud-white)",
        border: "1px solid var(--color-stone-border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-md)",
      }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid var(--color-stone-border)" }}
    >
      <div>
        <p className="text-[15px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
          {title}
        </p>
        {subtitle && <p className="mt-0.5 text-xs" style={{ color: "var(--color-ash-gray)" }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ─── AnalyticsPage ────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    const timer = window.setInterval(() => {
      fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    }, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const distribution = [
    { name: "Normal", value: data?.totals.normal ?? 0 },
    { name: "Warning", value: data?.totals.warning ?? 0 },
    { name: "Critical", value: data?.totals.critical ?? 0 },
    { name: "Offline", value: data?.totals.offline ?? 0 },
  ];
  const total = distribution.reduce((s, d) => s + d.value, 0);

  // Risk trend from top 5 bearings — generate mock time series based on current values
  const bearings = useMemo(() => data?.bearings ?? [], [data]);
  const top5 = useMemo(
    () => [...bearings].sort((a, b) => b.failureProbability - a.failureProbability).slice(0, 5),
    [bearings],
  );

  // Synthetic 7-point trend (decreasing towards current value)
  const riskTrend = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 7 : 7;
    return Array.from({ length: days }, (_, i) => {
      const label = `Day ${i + 1}`;
      const point: Record<string, string | number> = { day: label };
      for (const b of top5) {
        const variance = (days - i) * 3;
        point[b.id] = Math.max(0, Math.min(100, b.failureProbability - variance + Math.random() * 4));
      }
      return point;
    });
  }, [top5, range]);

  // Temperature trend (7 days)
  const tempTrend = useMemo(() => {
    const base = bearings.length
      ? bearings.reduce((s, b) => s + b.temperature, 0) / bearings.length
      : 65;
    return Array.from({ length: 7 }, (_, i) => ({
      day: `Day ${i + 1}`,
      temp: +(base - 5 + i * 1.5 + Math.random() * 3).toFixed(1),
    }));
  }, [bearings]);

  // Vibration trend (7 days)
  const vibTrend = useMemo(() => {
    const base = bearings.length
      ? bearings.reduce((s, b) => s + b.vibration, 0) / bearings.length
      : 1.8;
    return Array.from({ length: 7 }, (_, i) => ({
      day: `Day ${i + 1}`,
      vib: +(base + (i % 3) * 0.2 - 0.1).toFixed(2),
    }));
  }, [bearings]);

  const overrideRate = Math.round(data?.avgFailureProbability ?? 0) > 50 ? 18 : 12;
  const aiConfidence = 87;

  const lineColors = ["#f43f5e", "#f59e0b", "#3ba6f1", "#10b981", "#a78bfa"];

  const tooltipStyle = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <AppShell title="Analytics" searchPlaceholder="Search analytics...">
      <div className="flex flex-col gap-6 p-7 pb-20">
        {/* Date range selector */}
        <div className="flex justify-end">
          <div
            className="inline-flex rounded-full p-0.5"
            style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)" }}
          >
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: range === r ? "var(--color-cloud-white)" : "transparent",
                  color: range === r ? "var(--color-slate-text)" : "var(--color-ash-gray)",
                  boxShadow: range === r ? "var(--shadow-subtle)" : "none",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KpiCard
            label="Predictions Run"
            value="12,847"
            sub="in selected period"
          />
          <KpiCard
            label="Human Override Rate"
            value={`${overrideRate}%`}
            sub="Of AI decisions, operators changed the recommendation"
            valueColor={overrideRate > 20 ? "var(--color-amber)" : undefined}
          />
          <KpiCard
            label="Avg AI Confidence"
            value={`${aiConfidence}%`}
            sub="Across all agent votes in period"
            valueColor={aiConfidence < 70 ? "var(--color-rose)" : aiConfidence < 80 ? "var(--color-amber)" : undefined}
          />
        </div>

        {/* Main Charts */}
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          {/* Risk Trend */}
          <Card>
            <CardHead
              title="Bearing Failure Risk Over Time"
              subtitle={`Top 5 bearings — ${range} window`}
            />
            <div className="px-4 py-4" style={{ height: 280 }}>
              {mounted && riskTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={riskTrend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {/* Warning + critical reference lines */}
                    {top5.map((b, i) => (
                      <Line
                        key={b.id}
                        dataKey={b.id}
                        name={b.id}
                        stroke={lineColors[i] ?? "#94a3b8"}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                  {mounted ? "No data available." : "Loading..."}
                </div>
              )}
            </div>
          </Card>

          {/* Donut */}
          <Card>
            <CardHead title="Current Fleet Status" />
            <div className="flex flex-col items-center gap-4 px-6 py-5">
              {mounted ? (
                <PieChart width={180} height={180}>
                  <Pie
                    data={distribution}
                    cx={90}
                    cy={90}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {distribution.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              ) : null}
              <div className="w-full space-y-2">
                {distribution.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[d.name] }} />
                      <span style={{ color: "var(--color-ash-gray)" }}>{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: "var(--color-slate-text)" }}>{d.value}</span>
                      <span className="text-xs" style={{ color: "var(--color-ash-gray)" }}>
                        ({total ? Math.round((d.value / total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Secondary Charts */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Temperature Trend */}
          <Card>
            <CardHead title="Fleet Avg Temperature — Last 7 Days" />
            <div className="px-4 py-4" style={{ height: 220 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tempTrend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="tempFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area dataKey="temp" name="Temp (°C)" stroke="#f59e0b" fill="url(#tempFill)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </Card>

          {/* Vibration Trend */}
          <Card>
            <CardHead title="Fleet Avg Vibration — Last 7 Days" />
            <div className="px-4 py-4" style={{ height: 220 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vibTrend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="vib" name="Vibration (g)" fill="#3ba6f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </Card>
        </div>

        {/* Analytics Watchlist */}
        <Card>
          <CardHead title="Analytics Watchlist" subtitle="Priority units ranked by current failure probability" />
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ fontSize: 13, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "var(--color-canvas-fog)" }}>
                  {["Asset", "Status", "Failure Prob.", "RUL", "Temp", "Vibration"].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...bearings]
                  .sort((a, b) => b.failureProbability - a.failureProbability)
                  .slice(0, 8)
                  .map((b) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid var(--color-stone-border)" }}
                      className="transition-colors hover:bg-[#fafaf9]">
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: "var(--color-slate-text)" }}>{b.name}</p>
                        <p className="text-xs" style={{ color: "var(--color-ash-gray)" }}>{b.id} · {b.assetName}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: b.status === "critical" ? "var(--color-rose-tint)" : b.status === "warning" ? "var(--color-amber-tint)" : "var(--color-emerald-tint)",
                            color: b.status === "critical" ? "var(--color-rose)" : b.status === "warning" ? "var(--color-amber)" : "var(--color-emerald)",
                          }}
                        >
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: failColor(b.failureProbability) }}>
                        {Math.round(b.failureProbability)}%
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--color-slate-text)" }}>{Math.round(b.rul)}h</td>
                      <td className="px-5 py-3" style={{ color: b.temperature > 90 ? "var(--color-rose)" : b.temperature > 75 ? "var(--color-amber)" : "var(--color-slate-text)" }}>
                        {b.temperature.toFixed(1)}°C
                      </td>
                      <td className="px-5 py-3" style={{ color: b.vibration > 4 ? "var(--color-rose)" : b.vibration > 2.5 ? "var(--color-amber)" : "var(--color-slate-text)" }}>
                        {b.vibration.toFixed(2)} g
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[10px] p-5"
      style={{
        background: "var(--color-cloud-white)",
        border: "1px solid var(--color-stone-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--color-ash-gray)" }}>{label}</p>
      <p
        className="text-[34px] font-medium leading-tight"
        style={{ color: valueColor ?? "var(--color-slate-text)", letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: "var(--color-ash-gray)" }}>{sub}</p>}
    </div>
  );
}
