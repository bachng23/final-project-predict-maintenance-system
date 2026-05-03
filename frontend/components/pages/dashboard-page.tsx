"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Clock3, Gauge, Thermometer, Waves } from "lucide-react";

import { AnalyticsShell } from "@/components/analytics-shell";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type BearingStatus, type DashboardData, fetchDashboard } from "@/lib/backend-api";
import { cn } from "@/lib/utils";

function compactNumber(value: number, suffix = "") {
  return `${Math.round(value).toLocaleString("en-US")}${suffix}`;
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusVariant(status: BearingStatus) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  if (status === "normal") return "success";
  return "default";
}

function statusLabel(status: BearingStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    fetchDashboard(controller.signal).then(setData).catch(() => undefined);

    const timer = window.setInterval(() => {
      fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    }, 30000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const chartData = useMemo(
    () =>
      (data?.telemetry ?? []).map((point) => ({
        ...point,
        time: formatTime(point.timestamp),
      })),
    [data],
  );

  const mostCritical = useMemo(
    () =>
      [...(data?.bearings ?? [])].sort(
        (left, right) => right.failureProbability - left.failureProbability,
      )[0],
    [data],
  );

  return (
    <AnalyticsShell active="dashboard" searchPlaceholder="Search systems..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-8">
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Real-time Overview</p>
            <h2 className="font-headline text-[1.75rem] font-bold leading-tight text-white">Machine Health Overview</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Live bearings, health trends, and intervention priority from the backend feed.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              System: Nominal
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl md:col-span-4">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Prob. Calculation</span>
            </div>
            <p className="font-headline text-[3.5rem] font-bold leading-none text-white">
              {compactNumber(data?.avgFailureProbability ?? 0, "%")}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">Failure Probability</p>
            <p className="mt-1 text-xs text-slate-500">{data?.activeAlerts ?? 0} active alerts in the current fleet</p>
          </div>

          <div className="col-span-12 rounded-2xl border-x border-t border-b-4 border-slate-800 border-b-blue-500 bg-slate-900/80 p-6 shadow-xl md:col-span-4">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                <span className="material-symbols-outlined">timer</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Operational Life</span>
            </div>
            <p className="font-headline text-[3.5rem] font-bold leading-none text-white">
              <span>{Math.round(data?.avgRul ?? 0)}</span>
              <span className="ml-1 text-xl font-normal">hrs</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">Remaining Useful Life</p>
            <p className="mt-1 text-xs text-slate-500">Fleet-wide remaining life average</p>
          </div>

          <div className="col-span-12 overflow-hidden rounded-2xl border border-slate-800 md:col-span-4">
            <div className="flex h-full min-h-[260px] flex-col justify-end bg-[linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.92))] p-6">
              <p className="text-lg font-bold text-white">{mostCritical?.assetName ?? "Priority unit loading..."}</p>
              <p className="mt-1 text-xs text-white/70">{mostCritical?.location ?? "Waiting for live location data"}</p>
            </div>
          </div>

          <div className="col-span-12 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="font-manrope text-xl font-bold text-white">Health Engine</h3>
                <p className="text-xs text-slate-400">Aggregated telemetry from the monitored bearings</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Live Health Chart
                </div>
              </div>
            </div>
            <div className="h-[320px]">
              {mounted ? (
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={chartData} margin={{ bottom: 6, left: -12, right: 12, top: 10 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        color: "#e2e8f0",
                      }}
                    />
                    <Legend />
                    <Line dataKey="failureProbability" dot={false} name="Failure %" stroke="#fb7185" strokeWidth={2.5} />
                    <Line dataKey="temperature" dot={false} name="Temp C" stroke="#f59e0b" strokeWidth={2.5} />
                    <Line dataKey="vibration" dot={false} name="Vibration" stroke="#38bdf8" strokeWidth={2.5} />
                    <Line dataKey="healthScore" dot={false} name="Health" stroke="#34d399" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing chart...</div>
              )}
            </div>
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <QuickAlert color="red" icon="thermostat" label="High Temperature" />
            <QuickAlert color="blue" icon="vibration" label="Abnormal Vibration" />
            <QuickAlert color="green" icon="compress" label="Pressure Fluctuation" />
          </div>

          <div className="col-span-12 rounded-2xl border border-blue-500/20 bg-[linear-gradient(135deg,#1E3A8A,#0f172a)] p-8 shadow-2xl md:col-span-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/20 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <span className="material-symbols-outlined text-4xl">error</span>
              </div>
              <div className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">Critical Alert</p>
              </div>
              <div className="max-w-2xl">
                <h4 className="mb-3 font-headline text-2xl font-bold tracking-tight text-white">Urgent Action Required</h4>
                <p className="text-sm leading-relaxed text-blue-100/80">
                  {mostCritical
                    ? `${mostCritical.name} is leading the fleet risk profile. Review the asset now to prevent avoidable failure.`
                    : "Telemetry is loading for the highest-risk asset."}
                </p>
              </div>
              <div className="flex flex-row justify-center gap-4">
                <button className="rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10">
                  Reject
                </button>
                <button className="rounded-xl bg-green-500 px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_12px_rgba(34,197,94,0.3)] transition-all hover:bg-green-600">
                  Approve
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-12 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 md:col-span-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-blue-300">
                <span className="material-symbols-outlined">lightbulb</span>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-slate-500">Efficiency Tip</p>
                <p className="text-sm font-semibold text-slate-300">
                  Adjust coolant flow on the primary line to extend shaft life and lower bearing stress.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Status distribution across the monitored bearing fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {mounted ? (
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart
                      data={[
                        { name: "Normal", value: data?.totals.normal ?? 0 },
                        { name: "Warning", value: data?.totals.warning ?? 0 },
                        { name: "Critical", value: data?.totals.critical ?? 0 },
                        { name: "Offline", value: data?.totals.offline ?? 0 },
                      ]}
                      margin={{ left: -24, right: 12, top: 12 }}
                    >
                      <defs>
                        <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.75} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.06} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          color: "#e2e8f0",
                        }}
                      />
                      <Area dataKey="value" fill="url(#riskFill)" name="Bearings" stroke="#38bdf8" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing chart...</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Bearing Watchlist</CardTitle>
                <CardDescription>Prioritized bearings from the current monitoring feed</CardDescription>
              </div>
              <Badge>{data?.totals.bearings ?? 0} Bearings</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <div className="grid grid-cols-[1fr_120px_100px_88px] border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Bearing</span>
                  <span>Status</span>
                  <span>Failure</span>
                  <span>RUL</span>
                </div>
                {(data?.bearings ?? []).map((bearing) => (
                  <div
                    className="grid grid-cols-[1fr_120px_100px_88px] items-center border-b border-slate-800 px-4 py-4 transition-colors last:border-0 hover:bg-slate-800/55"
                    key={bearing.id}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={cn(
                            "h-4 w-4",
                            bearing.status === "critical"
                              ? "text-rose-300"
                              : bearing.status === "warning"
                                ? "text-amber-300"
                                : "text-emerald-300",
                          )}
                        />
                        <p className="truncate text-sm font-bold text-white">{bearing.name}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {bearing.id} - {bearing.assetName}
                      </p>
                    </div>
                    <Badge variant={statusVariant(bearing.status)}>{statusLabel(bearing.status)}</Badge>
                    <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.failureProbability)}%</span>
                    <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Condition Score</CardTitle>
              <CardDescription>Composite live score based on vibration, temperature, and pressure signals</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="flex items-center justify-center">
                <D3Gauge value={data?.avgHealthScore ?? 0} />
              </div>
              <div className="grid gap-4">
                <MetricRow icon={<Gauge className="h-4 w-4" />} label="Average Health" value={`${Math.round(data?.avgHealthScore ?? 0)} / 100`} />
                <MetricRow icon={<Thermometer className="h-4 w-4" />} label="Temperature Window" value={`${Math.round(chartData.at(-1)?.temperature ?? 0)} C`} />
                <MetricRow icon={<Waves className="h-4 w-4" />} label="Vibration RMS" value={`${(chartData.at(-1)?.vibration ?? 0).toFixed(2)} mm/s`} />
                <MetricRow icon={<Clock3 className="h-4 w-4" />} label="Average RUL" value={`${Math.round(data?.avgRul ?? 0)} hours`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert Summary</CardTitle>
              <CardDescription>Current high-signal observations from the latest telemetry window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertRow
                accent="critical"
                description="Primary spindle temperature crossed the warning threshold twice in the last hour."
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Thermal escalation"
              />
              <AlertRow
                accent="warning"
                description="Vibration profile is trending upward on two monitored assets."
                icon={<Waves className="h-4 w-4" />}
                label="Vibration drift"
              />
              <AlertRow
                accent="success"
                description="Pressure band remains stable across the remaining monitored bearings."
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Pressure stable"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AnalyticsShell>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <div className="flex items-center gap-3 text-slate-300">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function AlertRow({
  accent,
  description,
  icon,
  label,
}: {
  accent: "critical" | "warning" | "success";
  description: string;
  icon: ReactNode;
  label: string;
}) {
  const tone =
    accent === "critical"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : accent === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

  return (
    <div className={cn("rounded-xl border px-4 py-4", tone)}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAlert({ color, icon, label }: { color: "red" | "blue" | "green"; icon: string; label: string }) {
  const tone = {
    red: "bg-red-600/90 border-red-500/20 hover:bg-red-600",
    blue: "bg-blue-600/90 border-blue-500/20 hover:bg-blue-600",
    green: "bg-green-600/90 border-green-500/20 hover:bg-green-600",
  }[color];

  return (
    <button
      className={cn(
        "group flex items-center gap-4 rounded-xl border p-4 text-white shadow-lg transition-all duration-300 hover:-translate-y-1",
        tone,
      )}
      type="button"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
