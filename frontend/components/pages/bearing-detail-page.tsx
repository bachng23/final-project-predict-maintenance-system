"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Gauge, RotateCw, ShieldAlert, Thermometer, Waves } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BearingTimeseriesChart } from "@/components/charts/bearing-timeseries-chart";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setError(null);
        const detail = await fetchBearingDetail(bearingId, controller.signal);
        setData(detail);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load bearing detail.");
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
  }, [bearingId]);

  const latest = data?.telemetry.at(-1);
  const bearing = data?.bearing;
  const minRulHours = useMemo(() => {
    if (!data?.telemetry.length) return latest?.rul ?? bearing?.rul ?? 0;
    return Math.min(...data.telemetry.map((point) => point.rul));
  }, [bearing?.rul, data?.telemetry, latest?.rul]);
  const maxRulHours = useMemo(() => {
    if (!data?.telemetry.length) return Math.max(latest?.rul ?? bearing?.rul ?? 1, 1);
    return Math.max(...data.telemetry.map((point) => point.rul), 1);
  }, [bearing?.rul, data?.telemetry, latest?.rul]);
  const failureProbability = latest?.failureProbability ?? bearing?.failureProbability ?? 0;
  const healthScore = latest?.healthScore ?? bearing?.healthScore ?? 0;

  return (
    <AppShell title={`Bearing Detail ${bearing?.id ?? bearingId}`}>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-5 pb-24 md:p-8">
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

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
              <CardDescription>Lowest RUL observed in backend prediction history</CardDescription>
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
              <CardTitle>Health Score</CardTitle>
              <CardDescription>Most recent backend health prediction</CardDescription>
            </CardHeader>
            <CardContent>
              <D3Gauge label="Health Score" tone={rulTone((healthScore / 100) * 8)} value={healthScore} />
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

        <Card>
          <CardHeader>
            <CardTitle>Historical Prediction Trend</CardTitle>
            <CardDescription>
              Time-series returned directly from the Web Backend for RUL, health score, and failure probability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BearingTimeseriesChart points={data?.telemetry ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Failure Risk</CardTitle>
            <CardDescription>Most recent backend estimate for this bearing</CardDescription>
          </CardHeader>
          <CardContent>
            <D3Gauge label="Failure Probability" tone={failureTone(failureProbability)} value={failureProbability} />
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
