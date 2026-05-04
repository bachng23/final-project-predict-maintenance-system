"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Clock3, Gauge, RotateCw, ShieldAlert, Thermometer, Waves } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type BearingDetailData, fetchBearingDetail } from "@/lib/backend-api";

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function healthTone(value: number): "emerald" | "amber" | "rose" {
  if (value < 70) return "rose";
  if (value < 84) return "amber";
  return "emerald";
}

function failureTone(value: number): "emerald" | "amber" | "rose" {
  if (value >= 70) return "rose";
  if (value >= 35) return "amber";
  return "emerald";
}

export function BearingDetailPage({ bearingId }: { bearingId: string }) {
  const [data, setData] = useState<BearingDetailData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    fetchBearingDetail(bearingId, controller.signal).then(setData).catch(() => undefined);

    const timer = window.setInterval(() => {
      fetchBearingDetail(bearingId, controller.signal).then(setData).catch(() => undefined);
    }, 30000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [bearingId]);

  const chartData = useMemo(
    () =>
      (data?.telemetry ?? []).map((point) => ({
        ...point,
        time: formatTime(point.timestamp),
      })),
    [data],
  );

  const latest = data?.telemetry[data.telemetry.length - 1];
  const bearing = data?.bearing;
  const healthScore = latest?.healthScore ?? bearing?.healthScore ?? 0;
  const failureProbability = latest?.failureProbability ?? bearing?.failureProbability ?? 0;

  return (
    <AppShell active="bearing" status={data?.source ?? "demo"} title={`Bearing Detail ${bearing?.id ?? bearingId}`}>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-5 pb-24 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200" href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <h1 className="mt-4 font-headline text-3xl font-bold text-white">{bearing?.name ?? "Loading bearing detail"}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {bearing?.assetName ?? "Waiting for backend data"} · {bearing?.location ?? "Unknown location"}
            </p>
          </div>
          <Badge
            variant={
              bearing?.status === "critical" ? "danger" : bearing?.status === "warning" ? "warning" : "success"
            }
          >
            {bearing?.status ?? "loading"}
          </Badge>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.7fr_0.7fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Health Score</CardTitle>
              <CardDescription>D3.js gauge</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Bearing Health" tone={healthTone(healthScore)} value={healthScore} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Failure Risk</CardTitle>
              <CardDescription>Predicted failure probability</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Failure Probability" tone={failureTone(failureProbability)} value={failureProbability} />
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(135deg,#111827,#0f172a_52%,#1f2937)]">
            <CardHeader>
              <CardTitle>Operating Snapshot</CardTitle>
              <CardDescription>Latest values from the telemetry stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <SnapshotItem icon={<Waves className="h-4 w-4" />} label="Vibration RMS" value={`${(latest?.vibration ?? bearing?.vibration ?? 0).toFixed(2)} mm/s`} />
                <SnapshotItem icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={`${(latest?.temperature ?? bearing?.temperature ?? 0).toFixed(1)} °C`} />
                <SnapshotItem icon={<Gauge className="h-4 w-4" />} label="Pressure" value={`${(latest?.pressure ?? bearing?.pressure ?? 0).toFixed(2)} bar`} />
                <SnapshotItem icon={<RotateCw className="h-4 w-4" />} label="RPM" value={`${Math.round(latest?.rpm ?? 0).toLocaleString("en-US")}`} />
                <SnapshotItem icon={<Clock3 className="h-4 w-4" />} label="RUL" value={`${Math.round(latest?.rul ?? bearing?.rul ?? 0)} hours`} />
                <SnapshotItem icon={<ShieldAlert className="h-4 w-4" />} label="Updated" value={formatDateTime(bearing?.updatedAt ?? new Date().toISOString())} />
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Telemetry Time-series</CardTitle>
              <CardDescription>Recent 24-hour trend across vibration, temperature, failure risk, and RUL</CardDescription>
            </div>
            <Badge variant="default">24h Range</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[420px]">
              {mounted ? (
                <ResponsiveContainer height="100%" width="100%">
                  <ComposedChart data={chartData} margin={{ bottom: 8, left: -10, right: 12, top: 12 }}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" minTickGap={24} stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} yAxisId="left" />
                    <YAxis orientation="right" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} yAxisId="right" />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        color: "#e2e8f0",
                      }}
                    />
                    <Legend />
                    <Line dataKey="vibration" dot={false} name="Vibration mm/s" stroke="#38bdf8" strokeWidth={2.5} yAxisId="left" />
                    <Line dataKey="temperature" dot={false} name="Temperature °C" stroke="#f59e0b" strokeWidth={2.5} yAxisId="left" />
                    <Line dataKey="failureProbability" dot={false} name="Failure %" stroke="#fb7185" strokeWidth={2.5} yAxisId="right" />
                    <Line dataKey="rul" dot={false} name="RUL hours" stroke="#34d399" strokeWidth={2.5} yAxisId="right" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing chart...</div>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>Recent Telemetry Samples</CardTitle>
              <CardDescription>Latest records from the live telemetry stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <div className="grid grid-cols-[1fr_90px_90px_90px_90px] border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Time</span>
                  <span>Vibration</span>
                  <span>Temp</span>
                  <span>Risk</span>
                  <span>RUL</span>
                </div>
                {[...(data?.telemetry ?? [])]
                  .slice(-8)
                  .reverse()
                  .map((point) => (
                    <div
                      className="grid grid-cols-[1fr_90px_90px_90px_90px] border-b border-slate-800 px-4 py-3 text-sm text-slate-300 last:border-0"
                      key={point.timestamp}
                    >
                      <span className="text-slate-400">{formatDateTime(point.timestamp)}</span>
                      <span>{point.vibration.toFixed(2)}</span>
                      <span>{point.temperature.toFixed(1)}°C</span>
                      <span>{point.failureProbability.toFixed(1)}%</span>
                      <span>{Math.round(point.rul)}h</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance Recommendation</CardTitle>
              <CardDescription>Rule-based guidance derived from the current metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Recommendation active={failureProbability >= 70} text="Prioritize this bearing for immediate inspection during the current operating shift." />
                <Recommendation active={(latest?.temperature ?? bearing?.temperature ?? 0) >= 80} text="Temperature is elevated; inspect lubrication quality and shaft load." />
                <Recommendation active={(latest?.vibration ?? bearing?.vibration ?? 0) >= 4.5} text="Vibration exceeds the target band; schedule spectrum analysis and rebalancing." />
                <Recommendation active={(latest?.rul ?? bearing?.rul ?? 999) < 160} text="Remaining useful life is low; prepare the work order and replacement parts." />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function SnapshotItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-blue-300">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="font-headline text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function Recommendation({ active, text }: { active: boolean; text: string }) {
  return (
    <div className={active ? "rounded-lg border border-rose-500/30 bg-rose-500/10 p-4" : "rounded-lg border border-slate-800 bg-slate-950/40 p-4"}>
      <div className="flex gap-3">
        <span className={active ? "mt-1 h-2.5 w-2.5 rounded-full bg-rose-300" : "mt-1 h-2.5 w-2.5 rounded-full bg-slate-600"} />
        <p className={active ? "text-sm font-semibold leading-relaxed text-rose-100" : "text-sm leading-relaxed text-slate-400"}>
          {text}
        </p>
      </div>
    </div>
  );
}
