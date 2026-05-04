"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Search as SearchIcon } from "lucide-react";

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

export function BearingsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [query, setQuery] = useState("");

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

  const filteredBearings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...bearings].sort((left, right) => right.failureProbability - left.failureProbability);

    if (!normalizedQuery) return sorted;

    return sorted.filter((bearing) =>
      [bearing.id, bearing.name, bearing.assetName, bearing.location].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [bearings, query]);

  const criticalCount = bearings.filter((bearing) => bearing.status === "critical").length;
  const warningCount = bearings.filter((bearing) => bearing.status === "warning").length;
  const avgHealth = bearings.length
    ? Math.round(bearings.reduce((sum, bearing) => sum + bearing.healthScore, 0) / bearings.length)
    : 0;

  return (
    <AnalyticsShell active="bearings" searchPlaceholder="Search bearings..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6 pb-24 md:p-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Bearing Registry</p>
            <h1 className="mt-2 font-headline text-3xl font-bold text-white">Bearings Overview</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Review every monitored bearing, compare health metrics, and jump directly into the detailed page for each unit.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full rounded-full border border-slate-700 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter bearings..."
              value={query}
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Bearings" value={`${data?.totals.bearings ?? 0}`} />
          <MetricCard label="Critical Bearings" value={`${criticalCount}`} />
          <MetricCard label="Warning Bearings" value={`${warningCount}`} />
          <MetricCard label="Average Health" value={`${avgHealth}`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h3 className="font-manrope text-lg font-bold text-white">Bearing Inventory</h3>
                <p className="mt-1 text-sm text-slate-400">Live equipment list with routing into each detailed bearing page.</p>
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
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Bearing</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Health</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Failure</th>
                    <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">RUL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBearings.map((bearing) => (
                    <tr
                      key={bearing.id}
                      className={cn(
                        "border-b border-slate-800 transition-colors last:border-0 hover:bg-slate-800/55",
                        bearing.status === "critical" && "border-l-4 border-l-rose-500",
                      )}
                    >
                      <td className="px-6 py-4">
                        <Link className="block" href={`/bearings/${encodeURIComponent(bearing.id)}`}>
                          <p className="text-sm font-semibold text-white">{bearing.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {bearing.id} · {bearing.assetName} · {bearing.location}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={statusVariant(bearing.status)}>{titleCase(bearing.status)}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-slate-200">{Math.round(bearing.healthScore)}</td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-slate-200">{Math.round(bearing.failureProbability)}%</td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-slate-200">{Math.round(bearing.rul)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Priority Bearing</p>
                <p className="mt-4 font-headline text-3xl font-bold text-white">{filteredBearings[0]?.id ?? "--"}</p>
                <p className="mt-2 text-sm text-slate-400">The current highest-risk bearing in the active filtered list.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Average Temperature</p>
                <p className="mt-4 font-headline text-3xl font-bold text-white">
                  {bearings.length
                    ? `${Math.round(bearings.reduce((sum, bearing) => sum + bearing.temperature, 0) / bearings.length)}°C`
                    : "--"}
                </p>
                <p className="mt-2 text-sm text-slate-400">A quick thermal snapshot across the monitored set.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Navigation Hint</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Select any row in the table to open the bearing detail page and inspect its live telemetry history.
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
