"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Gauge, Thermometer, Waves } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BearingTimeseriesChart } from "@/components/charts/bearing-timeseries-chart";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type BearingStatus, type DashboardData, type TelemetryPoint, fetchBearingPredictions, fetchDashboard } from "@/lib/backend-api";
import { cn } from "@/lib/utils";

function compactNumber(value: number, suffix = "") {
  return `${Math.round(value).toLocaleString("en-US")}${suffix}`;
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

export function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [priorityHistory, setPriorityHistory] = useState<TelemetryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    const timer = window.setInterval(() => {
      load();
    }, 30000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const mostCritical = useMemo(
    () => [...(data?.bearings ?? [])].sort((left, right) => right.failureProbability - left.failureProbability)[0],
    [data],
  );

  useEffect(() => {
    if (!mostCritical) {
      setPriorityHistory([]);
      return;
    }

    const controller = new AbortController();
    fetchBearingPredictions(mostCritical.apiId, mostCritical, controller.signal, 36)
      .then(setPriorityHistory)
      .catch(() => setPriorityHistory([]));

    return () => controller.abort();
    // mostCritical object ref changes every poll even for the same bearing;
    // depend on apiId to only re-fetch when the priority bearing actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostCritical?.apiId]);

  return (
    <AppShell title="Dashboard Overview">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-5 pb-24 md:p-8">
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Real-time Overview</p>
                <h1 className="mt-2 font-headline text-3xl font-bold text-white">Machine Health Overview</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Live bearing health, RUL estimates, failure probability, and alerts from the predictive maintenance
                  pipeline.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <p className="font-headline text-2xl font-bold text-emerald-200">{data?.totals.normal ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Normal</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <p className="font-headline text-2xl font-bold text-amber-200">{data?.totals.warning ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Warning</p>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <p className="font-headline text-2xl font-bold text-rose-200">{data?.totals.critical ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Critical</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle>Fleet Health Gauge</CardTitle>
              <CardDescription>Average health score across all monitored bearings</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Average Health" tone="emerald" value={data?.avgHealthScore ?? 0} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Priority Bearing Trend</CardTitle>
              <CardDescription>
                Recent backend prediction history for {mostCritical?.name ?? "the highest-risk bearing"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BearingTimeseriesChart
                emptyMessage="No prediction history available yet for the current priority bearing."
                points={priorityHistory}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fleet Pulse</CardTitle>
              <CardDescription>Current operating envelope across all active bearings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(data?.bearings ?? []).slice(0, 5).map((bearing) => (
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4" key={bearing.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{bearing.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {bearing.id} · {bearing.assetName}
                      </p>
                    </div>
                    <Badge variant={statusVariant(bearing.status)}>{statusLabel(bearing.status)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <MiniStat label="Health" value={`${Math.round(bearing.healthScore)}%`} />
                    <MiniStat label="P(fail)" value={`${Math.round(bearing.failureProbability)}%`} />
                    <MiniStat label="RUL" value={`${Math.round(bearing.rul)}h`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Gauge className="h-5 w-5" />}
            label="Avg Failure Probability"
            value={compactNumber(data?.avgFailureProbability ?? 0, "%")}
            subtext={`${data?.activeAlerts ?? 0} active alerts`}
            tone="rose"
          />
          <MetricCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Average RUL"
            value={compactNumber(data?.avgRul ?? 0, "h")}
            subtext="Fleet-wide remaining useful life"
            tone="blue"
          />
          <MetricCard
            icon={<Thermometer className="h-5 w-5" />}
            label="Hottest Bearing"
            value={compactNumber(Math.max(...(data?.bearings.map((bearing) => bearing.temperature) ?? [0])), "°C")}
            subtext={mostCritical?.assetName ?? "Waiting for data"}
            tone="amber"
          />
          <MetricCard
            icon={<Waves className="h-5 w-5" />}
            label="Peak Vibration"
            value={`${Math.max(...(data?.bearings.map((bearing) => bearing.vibration) ?? [0])).toFixed(1)} mm/s`}
            subtext="RMS velocity"
            tone="emerald"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Bearing Watchlist</CardTitle>
                <CardDescription>Click a bearing to open its detail page</CardDescription>
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
                  <Link
                    className="grid grid-cols-[1fr_120px_100px_88px] items-center border-b border-slate-800 px-4 py-4 transition-colors last:border-0 hover:bg-slate-800/55"
                    href={`/bearings/${encodeURIComponent(bearing.id)}`}
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
                        {bearing.id} · {bearing.assetName}
                      </p>
                    </div>
                    <Badge variant={statusVariant(bearing.status)}>{statusLabel(bearing.status)}</Badge>
                    <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.failureProbability)}%</span>
                    <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority Bearing</CardTitle>
              <CardDescription>Highest-risk bearing requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              {mostCritical ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">{mostCritical.id}</p>
                        <h3 className="mt-2 font-headline text-xl font-bold text-white">{mostCritical.name}</h3>
                        <p className="mt-1 text-sm text-slate-300">{mostCritical.assetName}</p>
                      </div>
                      <AlertTriangle className="h-6 w-6 text-rose-300" />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <MiniStat label="Failure" value={`${Math.round(mostCritical.failureProbability)}%`} />
                      <MiniStat label="RUL" value={`${Math.round(mostCritical.rul)}h`} />
                      <MiniStat label="Temp" value={`${Math.round(mostCritical.temperature)}°C`} />
                    </div>
                  </div>
                  <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-400"
                    href={`/bearings/${encodeURIComponent(mostCritical.id)}`}
                  >
                    View Bearing Detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-500">Loading bearing data...</div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subtext: string;
  tone: "rose" | "amber" | "emerald" | "blue";
}) {
  const toneClass = {
    rose: "bg-rose-500/10 text-rose-300",
    amber: "bg-amber-500/10 text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    blue: "bg-blue-500/10 text-blue-300",
  }[tone];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-8 flex items-start justify-between">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", toneClass)}>{icon}</div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        </div>
        <p className="font-headline text-4xl font-bold leading-none text-white">{value}</p>
        <p className="mt-3 text-sm text-slate-400">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/60 p-3 text-center">
      <p className="font-headline text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
