"use client";

import Link from "next/link";
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
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Gauge, Thermometer, Waves } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type BearingStatus, type DashboardData, type HealthCheck, fetchDashboard, fetchHealth } from "@/lib/backend-api";
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
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    fetchHealth(controller.signal).then(setHealth).catch(() => undefined);

    const timer = window.setInterval(() => {
      fetchDashboard(controller.signal).then(setData).catch(() => undefined);
      fetchHealth(controller.signal).then(setHealth).catch(() => undefined);
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
    <AppShell active="dashboard" status={data?.source ?? "demo"} title="Dashboard Tổng Quan">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-5 pb-24 md:p-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Real-time Overview</p>
                <h1 className="mt-2 font-headline text-3xl font-bold text-white">Machine Health Overview</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Tổng hợp bearing health, RUL, xác suất lỗi và cảnh báo từ Web Backend.
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
              <CardDescription>D3.js gauge từ health score trung bình</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Average Health" tone="emerald" value={data?.avgHealthScore ?? 0} />
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
            subtext="Fleet-wide remaining life"
            tone="blue"
          />
          <MetricCard
            icon={<Thermometer className="h-5 w-5" />}
            label="Hottest Bearing"
            value={compactNumber(Math.max(...(data?.bearings.map((b) => b.temperature) ?? [0])), "°C")}
            subtext={mostCritical?.assetName ?? "Waiting for data"}
            tone="amber"
          />
          <MetricCard
            icon={<Waves className="h-5 w-5" />}
            label="Peak Vibration"
            value={`${Math.max(...(data?.bearings.map((b) => b.vibration) ?? [0])).toFixed(1)} mm/s`}
            subtext="RMS velocity"
            tone="emerald"
          />
        </section>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Nginx Health Check</CardTitle>
              <CardDescription>
                {health
                  ? `${health.service} · ${formatTime(health.checkedAt)}`
                  : "Waiting for /api/health response"}
              </CardDescription>
            </div>
            <Badge variant={health?.ok ? "success" : "warning"}>{health?.ok ? "Route OK" : "Checking"}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-200">
              {health?.ok ? "GET /api/health OK" : "GET /api/health is pending"}
            </p>
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Time-series Health Engine</CardTitle>
                <CardDescription>Recharts line chart cho vibration, temperature và failure probability</CardDescription>
              </div>
              <Badge variant="success">Live Chart</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
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
                      <Line
                        dataKey="failureProbability"
                        dot={false}
                        name="Failure %"
                        stroke="#fb7185"
                        strokeWidth={2.5}
                      />
                      <Line dataKey="temperature" dot={false} name="Temp °C" stroke="#f59e0b" strokeWidth={2.5} />
                      <Line dataKey="vibration" dot={false} name="Vibration" stroke="#38bdf8" strokeWidth={2.5} />
                      <Line dataKey="healthScore" dot={false} name="Health" stroke="#34d399" strokeWidth={2.5} />
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
              <CardTitle>Priority Bearing</CardTitle>
              <CardDescription>Bearing có rủi ro cao nhất hiện tại</CardDescription>
            </CardHeader>
            <CardContent>
              {mostCritical ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">
                          {mostCritical.id}
                        </p>
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
                    Xem chi tiết bearing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-500">Loading bearing data...</div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Tỷ lệ trạng thái của toàn bộ bearing</CardDescription>
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
                <CardDescription>Click vào một bearing để mở trang chi tiết</CardDescription>
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
                    <span className="text-sm font-semibold text-slate-200">
                      {Math.round(bearing.failureProbability)}%
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</span>
                  </Link>
                ))}
              </div>
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
  icon: React.ReactNode;
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
