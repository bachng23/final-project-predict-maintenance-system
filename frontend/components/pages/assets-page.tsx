"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, MoreVertical, Plus } from "lucide-react";

import { AnalyticsShell } from "@/components/analytics-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type BearingSummary, type DashboardData, fetchDashboard } from "@/lib/backend-api";
import { cn } from "@/lib/utils";

function statusVariant(status: BearingSummary["status"]) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  if (status === "normal") return "success";
  return "default";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AssetsPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
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

  const bearings = useMemo(() => data?.bearings ?? [], [data?.bearings]);
  const criticalCount = bearings.filter((bearing) => bearing.status === "critical").length;
  const watchlist = useMemo(
    () => [...bearings].sort((left, right) => right.failureProbability - left.failureProbability),
    [bearings],
  );

  return (
    <AnalyticsShell active="assets" searchPlaceholder="Search assets..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6 pb-24 md:p-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Asset Registry</p>
            <h1 className="mt-2 font-headline text-3xl font-bold text-white">Assets Overview</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Monitor active machines, compare their current health, and keep the most urgent units in view.
            </p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500">
            <Plus className="h-4 w-4" />
            Register Asset
          </button>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Monitored Bearings" value={`${data?.totals.bearings ?? 0}`} />
          <MetricCard label="Critical Units" value={`${criticalCount}`} />
          <MetricCard label="Average Failure" value={`${Math.round(data?.avgFailureProbability ?? 0)}%`} />
          <MetricCard label="Average RUL" value={`${Math.round(data?.avgRul ?? 0)}h`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h3 className="font-manrope text-lg font-bold text-white">Machine Fleet Status</h3>
                <p className="mt-1 text-sm text-slate-400">A live list of monitored units, aligned to the new interface.</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg border border-slate-700 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Filter">
                  <Filter className="h-4 w-4" />
                </button>
                <button className="rounded-lg border border-slate-700 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Download">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70">
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Bearing ID</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Failure</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">RUL</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Location</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((bearing) => (
                    <tr
                      key={bearing.id}
                      className={cn(
                        "border-b border-slate-800 transition-colors last:border-0 hover:bg-slate-800/55",
                        bearing.status === "critical" && "border-l-4 border-l-rose-500",
                      )}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-white">{bearing.id}</p>
                        <p className="mt-1 text-xs text-slate-500">{bearing.name}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={statusVariant(bearing.status)}>{titleCase(bearing.status)}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="mx-auto flex w-32 flex-col items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-300">{Math.round(bearing.failureProbability)}%</span>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                bearing.failureProbability >= 70
                                  ? "bg-rose-500"
                                  : bearing.failureProbability >= 35
                                    ? "bg-amber-400"
                                    : "bg-emerald-500",
                              )}
                              style={{ width: `${Math.min(100, Math.max(0, bearing.failureProbability))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-300">{bearing.location}</p>
                        <p className="mt-1 text-xs text-slate-500">{bearing.assetName}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" aria-label={`Open actions for ${bearing.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Operations Summary</p>
                <p className="mt-4 text-center font-headline text-4xl font-bold text-white">{data?.totals.normal ?? 0}</p>
                <p className="mt-2 text-center text-sm text-slate-400">Units running in a normal operating band.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Priority Window</p>
                <p className="mt-4 text-center font-headline text-4xl font-bold text-white">{watchlist[0] ? `${Math.round(watchlist[0].rul)}h` : "--"}</p>
                <p className="mt-2 text-center text-sm text-slate-400">Estimated intervention window for the highest-risk unit.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Asset Guidance</p>
                <p className="mt-4 text-center text-sm leading-relaxed text-slate-300">
                  Keep the fleet sorted by failure probability and focus immediate action on the first critical row.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AnalyticsShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-3 font-headline text-4xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}
