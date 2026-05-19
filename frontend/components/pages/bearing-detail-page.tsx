"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { DemoControls } from "@/components/charts/demo-controls";
import { D3Gauge } from "@/components/charts/d3-gauge";
import { RULChart } from "@/components/charts/rul-chart";
import { useRULStream } from "@/hooks/useRULStream";
import { type BearingDetailData, type BearingStatus, fetchBearingDetail } from "@/lib/backend-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(s?: BearingStatus | string) {
  if (s === "critical") return "var(--color-rose)";
  if (s === "warning") return "var(--color-amber)";
  if (s === "normal") return "var(--color-emerald)";
  return "var(--color-steel-gray)";
}

function statusBg(s?: BearingStatus | string) {
  if (s === "critical") return "var(--color-rose-tint)";
  if (s === "warning") return "var(--color-amber-tint)";
  if (s === "normal") return "var(--color-emerald-tint)";
  return "#f5f5f4";
}

function rulColor(rul: number) {
  if (rul < 24) return "var(--color-rose)";
  if (rul < 72) return "var(--color-amber)";
  return "var(--color-emerald)";
}

function failColor(p: number) {
  if (p >= 70) return "var(--color-rose)";
  if (p >= 35) return "var(--color-amber)";
  return "var(--color-emerald)";
}

function tempColor(t: number) {
  if (t > 90) return "var(--color-rose)";
  if (t > 75) return "var(--color-amber)";
  return "var(--color-slate-text)";
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatChartTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

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

function CardHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-stone-border)" }}>
      <p className="text-[15px] font-medium" style={{ color: "var(--color-slate-text)", letterSpacing: "-0.012em" }}>
        {title}
      </p>
      {subtitle && <p className="mt-0.5 text-xs" style={{ color: "var(--color-ash-gray)" }}>{subtitle}</p>}
    </div>
  );
}

function ConnectionPill({ label, connected }: { label: string; connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{
        background: connected ? "var(--color-emerald-tint)" : "var(--color-canvas-fog)",
        color: connected ? "var(--color-emerald)" : "var(--color-ash-gray)",
        border: "1px solid var(--color-stone-border)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: connected ? "var(--color-emerald)" : "var(--color-ash-gray)" }}
      />
      {label}: {connected ? "Connected" : "Waiting"}
    </span>
  );
}

// ─── BearingDetailPage ────────────────────────────────────────────────────────

export function BearingDetailPage({ bearingId }: { bearingId: string }) {
  const [data, setData] = useState<BearingDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    const load = async () => {
      try {
        setError(null);
        const detail = await fetchBearingDetail(bearingId, controller.signal);
        setData(detail);
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Unable to load bearing detail.");
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [bearingId]);

  const latest = data?.telemetry.at(-1);
  const bearing = data?.bearing;
  const streamBearingId = bearing?.id ?? bearingId;
  const {
    points: liveRulPoints,
    connected: predictionsConnected,
    snapshotsConnected,
    connectionError,
  } = useRULStream(streamBearingId);
  const wsConnected = predictionsConnected && snapshotsConnected;

  const failureProbability = latest?.failureProbability ?? bearing?.failureProbability ?? 0;
  const healthScore = latest?.healthScore ?? bearing?.healthScore ?? 0;
  const rul = latest?.rul ?? bearing?.rul ?? 0;

  const minRul = useMemo(() => {
    if (!data?.telemetry.length) return rul;
    return Math.min(...data.telemetry.map((p) => p.rul));
  }, [data?.telemetry, rul]);

  const maxRul = useMemo(() => {
    if (!data?.telemetry.length) return Math.max(rul, 1);
    return Math.max(...data.telemetry.map((p) => p.rul), 1);
  }, [data?.telemetry, rul]);

  const chartData = (data?.telemetry ?? []).map((p, i) => ({
    index: i,
    time: formatChartTime(p.timestamp),
    health: +p.healthScore.toFixed(1),
    pFail: +p.failureProbability.toFixed(1),
    rul: +p.rul.toFixed(1),
  }));

  const recommendations = [
    { active: failureProbability >= 70, sev: "HIGH", text: "Failure probability exceeds critical threshold (>70%)", thresh: "P_fail > 0.70" },
    { active: (latest?.temperature ?? bearing?.temperature ?? 0) >= 75, sev: "MEDIUM", text: "Temperature approaching limit — monitor closely", thresh: "Temp > 75°C" },
    { active: (latest?.vibration ?? bearing?.vibration ?? 0) >= 2, sev: "LOW", text: "Vibration elevated above baseline", thresh: "RMS > 2.0g" },
    { active: rul < 160, sev: "MEDIUM", text: "Remaining useful life is low — prepare work order", thresh: "RUL < 160h" },
  ].filter((r) => r.active);

  const sevColor = (s: string) =>
    s === "HIGH" ? "var(--color-rose)" :
    s === "MEDIUM" ? "var(--color-amber)" : "var(--color-chartwell-blue)";
  const sevBg = (s: string) =>
    s === "HIGH" ? "var(--color-rose-tint)" :
    s === "MEDIUM" ? "var(--color-amber-tint)" : "var(--color-blue-tint)";

  return (
    <AppShell title={`Bearing Detail`} searchPlaceholder="Search bearings...">
      <div className="flex flex-col gap-6 p-7 pb-20">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "var(--color-rose-tint)", color: "var(--color-rose)", border: "1px solid #fecdd3" }}>
            {error}
          </div>
        )}

        {/* Page header */}
        <div>
          <Link
            href="/bearings"
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ color: "var(--color-ash-gray)" }}
          >
            ← Back to Bearings
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              className="rounded-md px-2.5 py-1 font-mono text-[12px]"
              style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-slate-text)" }}
            >
              {bearing?.id ?? bearingId}
            </span>
            <h1
              className="text-[26px] font-medium"
              style={{ color: "var(--color-slate-text)", letterSpacing: "-0.02em" }}
            >
              {bearing?.name ?? "Loading..."}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: statusBg(bearing?.status), color: statusColor(bearing?.status) }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(bearing?.status) }} />
              {bearing?.status ? bearing.status.charAt(0).toUpperCase() + bearing.status.slice(1) : "—"}
            </span>
          </div>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-ash-gray)" }}>
            Last updated {bearing?.updatedAt ? formatDateTime(bearing.updatedAt) : "—"}
            {bearing?.assetName && (
              <> · <span style={{ color: "var(--color-chartwell-blue)" }}>View parent asset →</span></>
            )}
          </p>
        </div>

        {/* 3 Gauges */}
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <div className="px-6 py-5">
              <D3Gauge
                label="Health Score"
                value={Math.round(healthScore)}
                zones="health"
                subtitle={
                  healthScore <= 35 ? "Critical — Immediate attention" :
                  healthScore <= 70 ? "Warning — Monitor closely" : "Healthy"
                }
              />
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5">
              <D3Gauge
                label="Failure Probability"
                value={Math.round(failureProbability)}
                zones="risk"
                subtitle={`P(fail) = ${(failureProbability / 100).toFixed(2)}`}
              />
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5">
              <D3Gauge
                label="Remaining Useful Life"
                value={Math.round(minRul)}
                max={Math.max(Math.round(maxRul), 200)}
                unit="hrs"
                zones="rul"
                subtitle="Minimum observed RUL"
              />
            </div>
          </Card>
        </div>

        {/* Operating Snapshot */}
        <Card>
          <CardHead title="Operating Snapshot" subtitle="Latest real-time readings" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-6 md:grid-cols-3">
            <SnapCell label="Vibration RMS" value={`${(latest?.vibration ?? bearing?.vibration ?? 0).toFixed(2)}`} unit="g"
              color={(latest?.vibration ?? bearing?.vibration ?? 0) > 2.5 ? "var(--color-amber)" : undefined} />
            <SnapCell label="Temperature" value={`${(latest?.temperature ?? bearing?.temperature ?? 0).toFixed(1)}`} unit="°C"
              color={tempColor(latest?.temperature ?? bearing?.temperature ?? 0)} />
            <SnapCell label="Pressure" value={`${(latest?.pressure ?? bearing?.pressure ?? 0).toFixed(2)}`} unit="bar" />
            <SnapCell label="RPM" value={`${Math.round(latest?.rpm ?? bearing?.rpm ?? 0).toLocaleString()}`} unit="rpm" />
            <SnapCell label="Current RUL" value={`${Math.round(rul)}`} unit="hrs" color={rulColor(rul)} />
            <SnapCell label="Last Updated" value={formatDateTime(bearing?.updatedAt ?? new Date().toISOString())} />
          </div>
        </Card>

        {/* Historical Chart */}
        <Card>
          <CardHead title="Historical Prediction Trend" subtitle="Health score, failure probability, and RUL over time" />
          <div className="px-4 py-4" style={{ height: 320 }}>
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="index" tickFormatter={(i) => chartData[i]?.time ?? ""} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(i) => chartData[i as number]?.time ?? ""}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Area yAxisId="left" dataKey="health" name="Health Score" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" dataKey="pFail" name="Failure Prob." stroke="#f43f5e" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" dataKey="rul" name="RUL (hrs)" stroke="#3ba6f1" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                {mounted ? "No telemetry history available." : "Loading chart..."}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Live WebSocket Stream" subtitle="Realtime prediction and snapshot connection state" />
          <div className="space-y-5 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <ConnectionPill label="Predictions" connected={predictionsConnected} />
              <ConnectionPill label="Snapshots" connected={snapshotsConnected} />
              <span className="ml-auto text-xs" style={{ color: "var(--color-ash-gray)" }}>
                {liveRulPoints.length} live samples
              </span>
            </div>

            {connectionError && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{
                  background: "var(--color-rose-tint)",
                  color: "var(--color-rose)",
                  border: "1px solid #fecdd3",
                }}
              >
                {connectionError}
              </div>
            )}

            <DemoControls defaultBearingId={streamBearingId} />
            <RULChart connected={wsConnected} points={liveRulPoints} />
          </div>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHead title="AI Recommendations" subtitle="Rule-based alerts from current readings" />
          <div className="flex flex-col divide-y px-6" style={{ borderColor: "var(--color-stone-border)" }}>
            {recommendations.length === 0 ? (
              <p className="py-5 text-sm" style={{ color: "var(--color-ash-gray)" }}>No active recommendations.</p>
            ) : recommendations.map((rec, i) => (
              <div key={i} className="flex items-center gap-4 py-3.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sevColor(rec.sev) }} />
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: sevBg(rec.sev), color: sevColor(rec.sev) }}
                >
                  {rec.sev}
                </span>
                <span className="flex-1 text-sm" style={{ color: "var(--color-slate-text)" }}>{rec.text}</span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                  style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
                >
                  {rec.thresh}
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 pb-5 pt-2">
            <Link
              href="/policy"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--color-chartwell-blue)" }}
            >
              View in Decision Queue →
            </Link>
          </div>
        </Card>

        {/* Agent Transcript (collapsible) */}
        <Card>
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-4"
            onClick={() => setTranscriptOpen((v) => !v)}
          >
            <span className="text-[15px] font-medium" style={{ color: "var(--color-slate-text)" }}>
              Show AI reasoning
            </span>
            {transcriptOpen ? (
              <ChevronUp className="h-4 w-4" style={{ color: "var(--color-ash-gray)" }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: "var(--color-ash-gray)" }} />
            )}
          </button>
          {transcriptOpen && (
            <div className="px-6 pb-6">
              <div
                className="rounded-lg p-4 text-sm"
                style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
              >
                Multi-agent negotiation transcript for the latest decision will appear here when the agent system produces a recommendation.
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function SnapCell({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ash-gray)" }}>
        {label}
      </span>
      <span className="text-[22px] font-medium" style={{ color: color ?? "var(--color-slate-text)", letterSpacing: "-0.015em" }}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal" style={{ color: "var(--color-ash-gray)" }}>{unit}</span>}
      </span>
    </div>
  );
}
