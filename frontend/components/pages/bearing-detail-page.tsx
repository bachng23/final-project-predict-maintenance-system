"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Gauge, RotateCw, ShieldAlert, Thermometer, Waves } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { DemoControls } from "@/components/charts/demo-controls";
import { RULChart } from "@/components/charts/rul-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRULStream } from "@/hooks/useRULStream";
import { type BearingDetailData, fetchBearingDetail } from "@/lib/backend-api";

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatRulHours(hours: number) {
  return `${hours.toFixed(1)} hr`;
}

function rulTone(hours: number): "emerald" | "amber" | "rose" {
  if (hours < 2) return "rose";
  if (hours < 5) return "amber";
  return "emerald";
}

function failureTone(value: number): "emerald" | "amber" | "rose" {
  if (value >= 70) return "rose";
  if (value >= 35) return "amber";
  return "emerald";
}

function statusVariant(status?: string) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  return "success";
}
export function BearingDetailPage({ bearingId }: { bearingId: string }) {
  const [data, setData] = useState<BearingDetailData | null>(null);
  const [streamBearingId, setStreamBearingId] = useState(bearingId);
  const { connected, points: livePoints } = useRULStream(streamBearingId);

  const [gaugeFailure, setGaugeFailure] = useState<number | null>(null);

  useEffect(() => {
    if (livePoints.length === 0) return;
    const last = livePoints[livePoints.length - 1];
    setGaugeFailure(last.pFail * 100);
  }, [livePoints]);

  useEffect(() => {
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

  const latest = data?.telemetry[data.telemetry.length - 1];
  const bearing = data?.bearing;
  const fallbackRulMinutes = ((latest?.rul ?? bearing?.rul ?? 0) * 60);
  const minRulMinutes = useMemo(() => {
    if (livePoints.length === 0) return fallbackRulMinutes;
    return Math.min(...livePoints.map((point) => point.rulMinutes));
  }, [fallbackRulMinutes, livePoints]);
  const maxRulMinutes = useMemo(() => {
    if (livePoints.length === 0) return Math.max(fallbackRulMinutes, 1);
    return Math.max(...livePoints.map((point) => point.rulMinutes), minRulMinutes, 1);
  }, [fallbackRulMinutes, livePoints, minRulMinutes]);
  const minRulHours = minRulMinutes / 60;
  const maxRulHours = Math.max(maxRulMinutes / 60, 0.1);
  // Prefer live stream values; fall back to static API data
  const failureProbability = gaugeFailure ?? latest?.failureProbability ?? bearing?.failureProbability ?? 0;

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
          <Badge variant={statusVariant(bearing?.status)}>{bearing?.status ?? "loading"}</Badge>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.7fr_0.7fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Minimum RUL</CardTitle>
              <CardDescription>Lowest RUL seen in this live stream</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Remaining Useful Life" max={maxRulHours} tone={rulTone(minRulHours)} unit="hr" value={minRulHours} />
              <p className="-mt-4 text-center text-xs font-semibold text-slate-400">
                {formatRulHours(minRulHours)} minimum observed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Failure Risk</CardTitle>
              <CardDescription>Updates from the live prediction stream</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Failure Probability" tone={failureTone(failureProbability)} value={failureProbability} />
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(135deg,#111827,#0f172a_52%,#1f2937)]">
            <CardHeader>
              <CardTitle>Operating Snapshot</CardTitle>
              <CardDescription>Latest metrics for the selected bearing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <SnapshotItem icon={<Waves className="h-4 w-4" />} label="Vibration RMS" value={`${(latest?.vibration ?? bearing?.vibration ?? 0).toFixed(2)} mm/s`} />
                <SnapshotItem icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={`${(latest?.temperature ?? bearing?.temperature ?? 0).toFixed(1)} °C`} />
                <SnapshotItem icon={<Gauge className="h-4 w-4" />} label="Pressure" value={`${(latest?.pressure ?? bearing?.pressure ?? 0).toFixed(2)} bar`} />
                <SnapshotItem
                  icon={<RotateCw className="h-4 w-4" />}
                  label="RPM"
                  value={`${Math.round(latest?.rpm ?? bearing?.rpm ?? 0).toLocaleString("en-US")}`}
                />
                <SnapshotItem icon={<Clock3 className="h-4 w-4" />} label="RUL" value={`${Math.round(latest?.rul ?? bearing?.rul ?? 0)} hours`} />
                <SnapshotItem icon={<ShieldAlert className="h-4 w-4" />} label="Updated" value={formatDateTime(bearing?.updatedAt ?? new Date().toISOString())} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Live RUL Stream */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Live RUL Stream</CardTitle>
              <CardDescription>Real-time remaining useful life from the prediction pipeline · orange ⚠ markers = anomaly trigger</CardDescription>
            </div>
            <DemoControls
              onStart={(id) => setStreamBearingId(id)}
              onStop={() => setStreamBearingId(bearingId)}
            />
          </CardHeader>
          <CardContent>
            <RULChart connected={connected} points={livePoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Recommendation</CardTitle>
            <CardDescription>Rule-based guidance using the current bearing state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Recommendation active={failureProbability >= 70} text="Prioritize inspection during the current operating window." />
              <Recommendation active={(latest?.temperature ?? bearing?.temperature ?? 0) >= 80} text="Temperature is elevated. Review lubrication and shaft load immediately." />
              <Recommendation active={(latest?.vibration ?? bearing?.vibration ?? 0) >= 4.5} text="Vibration exceeds the preferred band. Run balancing and spectral checks." />
              <Recommendation active={(latest?.rul ?? bearing?.rul ?? 999) < 160} text="Remaining useful life is low. Prepare a work order and replacement parts." />
            </div>
          </CardContent>
        </Card>
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
        <p className={active ? "text-sm font-semibold leading-relaxed text-rose-100" : "text-sm leading-relaxed text-slate-400"}>{text}</p>
      </div>
    </div>
  );
}
