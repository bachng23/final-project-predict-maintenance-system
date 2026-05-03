"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Clock3, TrendingUp, Waves } from "lucide-react";

import { AnalyticsShell } from "@/components/analytics-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type DashboardData, fetchDashboard } from "@/lib/backend-api";
import { cn } from "@/lib/utils";

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

export function AnalyticsPage() {
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

  const series = useMemo(
    () =>
      (data?.telemetry ?? []).map((point) => ({
        ...point,
        time: formatTime(point.timestamp),
      })),
    [data],
  );

  const distribution = [
    { name: "Normal", value: data?.totals.normal ?? 0 },
    { name: "Warning", value: data?.totals.warning ?? 0 },
    { name: "Critical", value: data?.totals.critical ?? 0 },
    { name: "Offline", value: data?.totals.offline ?? 0 },
  ];

  const highestRisk = useMemo(
    () =>
      [...(data?.bearings ?? [])].sort(
        (left, right) => right.failureProbability - left.failureProbability,
      )[0],
    [data],
  );

  return (
    <AnalyticsShell active="analytics" searchPlaceholder="Search analytics..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6 pb-24 md:p-8">
        <section className="rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Performance Metrics</p>
              <h1 className="mt-2 font-headline text-3xl font-bold text-white">Analytics Insights</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Review multi-signal trends, fleet distribution, and the highest-risk assets from the current telemetry stream.
              </p>
            </div>
            <Badge variant="success">Operationally Stable</Badge>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Average Failure Risk"
            value={percentage(data?.avgFailureProbability ?? 0)}
            subtext="Rolling fleet average"
          />
          <MetricCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Average Remaining Life"
            value={`${Math.round(data?.avgRul ?? 0)}h`}
            subtext="Across all monitored bearings"
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Active Alerts"
            value={`${data?.activeAlerts ?? 0}`}
            subtext="Warning and critical combined"
          />
          <MetricCard
            icon={<Activity className="h-5 w-5" />}
            label="Average Health Score"
            value={`${Math.round(data?.avgHealthScore ?? 0)}`}
            subtext="Composite equipment health"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>Failure risk, temperature, and vibration over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
                {mounted ? (
                  <ResponsiveContainer height="100%" width="100%">
                    <LineChart data={series} margin={{ bottom: 8, left: -12, right: 12, top: 12 }}>
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
                      <Line dataKey="failureProbability" dot={false} name="Failure %" stroke="#fb7185" strokeWidth={2.5} />
                      <Line dataKey="temperature" dot={false} name="Temperature °C" stroke="#f59e0b" strokeWidth={2.5} />
                      <Line dataKey="vibration" dot={false} name="Vibration mm/s" stroke="#38bdf8" strokeWidth={2.5} />
                      <Line dataKey="rul" dot={false} name="RUL hours" stroke="#34d399" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing chart...</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Current fleet status spread</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
                {mounted ? (
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={distribution} margin={{ bottom: 8, left: -18, right: 10, top: 12 }}>
                      <defs>
                        <linearGradient id="analyticsRiskFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.7} />
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          color: "#e2e8f0",
                        }}
                      />
                      <Area dataKey="value" fill="url(#analyticsRiskFill)" stroke="#60a5fa" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing chart...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Highest-Risk Asset</CardTitle>
              <CardDescription>The most urgent unit in the current fleet snapshot</CardDescription>
            </CardHeader>
            <CardContent>
              {highestRisk ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">{highestRisk.id}</p>
                    <h3 className="mt-3 font-headline text-2xl font-bold text-white">{highestRisk.name}</h3>
                    <p className="mt-2 text-sm text-slate-300">{highestRisk.assetName}</p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <MiniStat label="Failure" value={percentage(highestRisk.failureProbability)} />
                      <MiniStat label="RUL" value={`${Math.round(highestRisk.rul)}h`} />
                      <MiniStat label="Vibration" value={`${highestRisk.vibration.toFixed(1)}`} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-3 flex items-center justify-center gap-2 text-blue-300">
                      <Waves className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Analyst Summary</span>
                    </div>
                    <p className="text-center text-sm leading-relaxed text-slate-300">
                      This asset is leading the fleet in failure probability and should remain the primary focus for intervention planning.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-slate-500">Loading asset data...</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics Watchlist</CardTitle>
              <CardDescription>Priority units ranked by current failure probability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-[1.3fr_110px_110px_110px] bg-slate-950/70 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="text-left">Asset</span>
                  <span>Status</span>
                  <span>Failure</span>
                  <span>RUL</span>
                </div>
                {[...(data?.bearings ?? [])]
                  .sort((left, right) => right.failureProbability - left.failureProbability)
                  .slice(0, 6)
                  .map((bearing) => (
                    <div
                      key={bearing.id}
                      className="grid grid-cols-[1.3fr_110px_110px_110px] items-center border-t border-slate-800 px-4 py-4 text-center"
                    >
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-bold text-white">{bearing.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {bearing.id} · {bearing.assetName}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex justify-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                          bearing.status === "critical"
                            ? "bg-rose-500/15 text-rose-300"
                            : bearing.status === "warning"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300",
                        )}
                      >
                        {bearing.status}
                      </span>
                      <span className="text-sm font-semibold text-slate-200">{percentage(bearing.failureProbability)}</span>
                      <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AnalyticsShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">{icon}</div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-3 font-headline text-4xl font-bold leading-none text-white">{value}</p>
        <p className="mt-3 text-sm text-slate-400">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/60 p-3 text-center">
      <p className="font-headline text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
