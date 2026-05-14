"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { type BearingStatus, type BearingSummary, type DashboardData, type TelemetryPoint, fetchBearingPredictions, fetchDashboard } from "@/lib/backend-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: BearingStatus) {
  if (status === "critical") return "var(--color-rose)";
  if (status === "warning") return "var(--color-amber)";
  if (status === "normal") return "var(--color-emerald)";
  return "var(--color-steel-gray)";
}

function statusBg(status: BearingStatus) {
  if (status === "critical") return "var(--color-rose-tint)";
  if (status === "warning") return "var(--color-amber-tint)";
  if (status === "normal") return "var(--color-emerald-tint)";
  return "#f5f5f4";
}

function statusLabel(status: BearingStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function failColor(pFail: number) {
  if (pFail >= 70) return "var(--color-rose)";
  if (pFail >= 35) return "var(--color-amber)";
  return "var(--color-emerald)";
}

function rulColor(rul: number) {
  if (rul < 24) return "var(--color-rose)";
  if (rul < 72) return "var(--color-amber)";
  return "var(--color-slate-text)";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatChartTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const EMPTY_DASHBOARD: DashboardData = {
  generatedAt: "",
  totals: { bearings: 0, normal: 0, warning: 0, critical: 0, offline: 0 },
  avgHealthScore: 0,
  avgFailureProbability: 0,
  avgRul: 0,
  activeAlerts: 0,
  bearings: [],
  source: "backend",
};

// ─── card primitives ───────────────────────────────────────────────────────────

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

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid var(--color-stone-border)" }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: BearingStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: statusBg(status), color: statusColor(status) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(status) }} />
      {statusLabel(status)}
    </span>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [priorityHistory, setPriorityHistory] = useState<TelemetryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    const load = async () => {
      try {
        setError(null);
        const dashboard = await fetchDashboard(controller.signal);
        setData(dashboard);
      } catch (caught) {
        if ((caught as Error)?.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Unable to load dashboard data.");
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const mostCritical = useMemo(
    () => [...(data?.bearings ?? [])].sort((a, b) => b.failureProbability - a.failureProbability)[0],
    [data],
  );

  useEffect(() => {
    if (!mostCritical) { setPriorityHistory([]); return; }
    const controller = new AbortController();
    fetchBearingPredictions(mostCritical.apiId, mostCritical, controller.signal, 36)
      .then(setPriorityHistory)
      .catch(() => setPriorityHistory([]));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostCritical?.apiId]);

  const chartData = priorityHistory.map((p) => ({
    time: formatChartTime(p.timestamp),
    health: Math.round(p.healthScore),
    pFail: Math.round(p.failureProbability),
  }));

  const topRisk = useMemo(
    () => [...(data?.bearings ?? [])].sort((a, b) => b.failureProbability - a.failureProbability).slice(0, 5),
    [data],
  );

  const hottest = useMemo(
    () => [...(data?.bearings ?? [])].sort((a, b) => b.temperature - a.temperature)[0],
    [data],
  );

  const peakVib = useMemo(
    () => [...(data?.bearings ?? [])].sort((a, b) => b.vibration - a.vibration)[0],
    [data],
  );

  return (
    <AppShell title="Dashboard" searchPlaceholder="Search bearings...">
      <div className="flex flex-col gap-8 p-7 pb-20">
        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "var(--color-rose-tint)", color: "var(--color-rose)", border: "1px solid #fecdd3" }}
          >
            {error}
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          <MetricCard
            label="Avg Failure Probability"
            value={`${Math.round(data.avgFailureProbability)}%`}
            valueColor={failColor(data.avgFailureProbability)}
            trend={<><TrendingUp className="h-3 w-3" /> 3% from yesterday</>}
            trendUp
          />
          <MetricCard
            label="Avg Remaining Useful Life"
            value={`${Math.round(data.avgRul)}`}
            valueUnit="hrs"
            valueColor={rulColor(data.avgRul)}
            trend={<><TrendingDown className="h-3 w-3" /> 12h from yesterday</>}
            trendUp={false}
          />
          <MetricCard
            label="Peak Temperature"
            value={hottest ? `${Math.round(hottest.temperature)}°C` : "—"}
            sub={hottest?.id}
            valueColor={hottest && hottest.temperature > 90 ? "var(--color-rose)" : hottest && hottest.temperature > 75 ? "var(--color-amber)" : undefined}
          />
          <MetricCard
            label="Peak Vibration RMS"
            value={peakVib ? `${peakVib.vibration.toFixed(1)} g` : "—"}
            sub={peakVib?.id}
            valueColor={peakVib && peakVib.vibration > 4 ? "var(--color-rose)" : peakVib && peakVib.vibration > 2.5 ? "var(--color-amber)" : undefined}
          />
        </div>

        {/* Fleet Health + Priority Trend / Fleet Pulse */}
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Fleet Health Gauge */}
            <Card>
              <CardHeader>
                <span className="text-[16px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
                  Fleet Health Score
                </span>
              </CardHeader>
              <div className="flex flex-col items-center gap-6 px-6 py-6 md:flex-row md:items-center md:gap-10">
                <div className="w-full max-w-[240px]">
                  <D3Gauge
                    label="Fleet Health"
                    value={Math.round(data.avgHealthScore)}
                    zones="health"
                    subtitle={
                      data.avgHealthScore >= 70 ? "Healthy" :
                      data.avgHealthScore >= 35 ? "Warning" : "Critical"
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { status: "normal" as BearingStatus, count: data.totals.normal },
                    { status: "warning" as BearingStatus, count: data.totals.warning },
                    { status: "critical" as BearingStatus, count: data.totals.critical },
                    { status: "offline" as BearingStatus, count: data.totals.offline },
                  ].map(({ status, count }) => (
                    <div
                      key={status}
                      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
                      style={{
                        background: "var(--color-canvas-fog)",
                        border: "1px solid var(--color-stone-border)",
                        color: "var(--color-slate-text)",
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: statusColor(status) }} />
                      <span className="font-semibold">{count}</span>
                      <span style={{ color: "var(--color-ash-gray)", fontWeight: 400 }}>{statusLabel(status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Priority Trend Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
                    {mostCritical?.name ?? "Priority Bearing"} — Health Score, Last 48h
                  </span>
                  {mostCritical?.status === "critical" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: "var(--color-rose-tint)", color: "var(--color-rose)" }}
                    >
                      Critical
                    </span>
                  )}
                </div>
              </CardHeader>
              <div className="px-4 py-4" style={{ height: 220 }}>
                {mounted && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="healthFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#3ba6f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3ba6f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                      />
                      <Area dataKey="health" name="Health Score" stroke="#3ba6f1" strokeWidth={2} fill="url(#healthFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                    {mounted ? "No prediction history available." : "Loading chart..."}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Fleet Pulse */}
          <Card>
            <CardHeader>
              <div>
                <p className="text-[16px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
                  Fleet Pulse
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--color-ash-gray)" }}>
                  5 highest-risk bearings right now
                </p>
              </div>
            </CardHeader>
            <div className="flex flex-col divide-y px-5 py-2" style={{ borderColor: "var(--color-stone-border)" }}>
              {topRisk.length === 0
                ? <div className="py-10 text-center text-sm" style={{ color: "var(--color-ash-gray)" }}>Loading...</div>
                : topRisk.map((b) => (
                  <PulseRow key={b.id} bearing={b} />
                ))}
            </div>
            <div className="px-5 pb-4 pt-2">
              <Link
                href="/bearings"
                className="flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--color-chartwell-blue)" }}
              >
                View all bearings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>

        {/* Bearing Watchlist Table */}
        <Card>
          <CardHeader>
            <span className="text-[16px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
              Bearing Watchlist
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
            >
              {data.totals.bearings} bearings
            </span>
          </CardHeader>
          <WatchlistTable bearings={data.bearings} />
        </Card>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueUnit,
  valueColor,
  sub,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  valueUnit?: string;
  valueColor?: string;
  sub?: string;
  trend?: ReactNode;
  trendUp?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-[10px] p-5"
      style={{
        background: "var(--color-cloud-white)",
        border: "1px solid var(--color-stone-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--color-ash-gray)" }}>{label}</p>
      <p
        className="mt-1 text-[32px] font-medium leading-tight"
        style={{ color: valueColor ?? "var(--color-slate-text)", letterSpacing: "-0.02em" }}
      >
        {value}
        {valueUnit && <span className="ml-1 text-lg font-normal" style={{ color: "var(--color-ash-gray)" }}>{valueUnit}</span>}
      </p>
      {sub && <p className="text-xs" style={{ color: "var(--color-ash-gray)" }}>{sub}</p>}
      {trend && (
        <div
          className="mt-1 flex items-center gap-1 text-xs font-medium"
          style={{ color: trendUp ? "var(--color-rose)" : "var(--color-emerald)" }}
        >
          {trend}
        </div>
      )}
    </div>
  );
}

function PulseRow({ bearing }: { bearing: BearingSummary }) {
  const pFail = Math.round(bearing.failureProbability);
  const barColor = failColor(pFail);
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium" style={{ color: "var(--color-slate-text)" }}>
          {bearing.name}
        </p>
        <p className="truncate text-[11px]" style={{ color: "var(--color-ash-gray)" }}>
          {bearing.location}
        </p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-canvas-fog)" }}>
          <div className="h-full rounded-full" style={{ width: `${pFail}%`, background: barColor }} />
        </div>
      </div>
      <StatusBadge status={bearing.status} />
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: rulColor(bearing.rul), minWidth: 48, textAlign: "right" }}
      >
        {Math.round(bearing.rul)}
        <span className="text-xs font-normal" style={{ color: "var(--color-ash-gray)" }}> hrs</span>
      </span>
    </div>
  );
}

function WatchlistTable({ bearings }: { bearings: BearingSummary[] }) {
  const sorted = useMemo(
    () => [...bearings].sort((a, b) => b.failureProbability - a.failureProbability),
    [bearings],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ fontSize: 13, borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: "var(--color-canvas-fog)" }}>
            {["Bearing ID", "Name", "Status", "Failure Prob.", "RUL", "Fault Type", "Last Updated", ""].map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="py-10 text-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                Loading bearings...
              </td>
            </tr>
          )}
          {sorted.map((b) => {
            const rowBg =
              b.status === "critical" ? "rgba(244,63,94,0.04)" :
              b.status === "warning" ? "rgba(245,158,11,0.04)" : undefined;
            return (
              <tr
                key={b.id}
                style={{ background: rowBg, borderBottom: "1px solid var(--color-stone-border)" }}
                className="transition-colors hover:bg-[#fafaf9]"
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-slate-text)", whiteSpace: "nowrap" }}>
                  {b.id}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-slate-text)" }}>{b.name}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3 font-semibold" style={{ color: failColor(b.failureProbability) }}>
                  {Math.round(b.failureProbability)}%
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: rulColor(b.rul) }}>
                  {Math.round(b.rul)}h
                </td>
                <td className="px-4 py-3">
                  {b.location ? (
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                      style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
                    >
                      —
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--color-ash-gray)" }}>
                  {relativeTime(b.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/bearings/${encodeURIComponent(b.id)}`}
                    className="text-xs font-medium"
                    style={{ color: "var(--color-chartwell-blue)", whiteSpace: "nowrap" }}
                  >
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > 0 && (
        <div
          className="flex items-center justify-between px-5 py-3 text-xs"
          style={{ borderTop: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
        >
          <span>Showing {sorted.length} bearings</span>
        </div>
      )}
    </div>
  );
}
