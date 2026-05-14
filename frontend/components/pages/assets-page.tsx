"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { type BearingSummary, type DashboardData, fetchDashboard } from "@/lib/backend-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function failColor(p: number) {
  if (p >= 70) return "var(--color-rose)";
  if (p >= 35) return "var(--color-amber)";
  return "var(--color-emerald)";
}

function statusColor(s: BearingSummary["status"]) {
  if (s === "critical") return "var(--color-rose)";
  if (s === "warning") return "var(--color-amber)";
  if (s === "normal") return "var(--color-emerald)";
  return "var(--color-steel-gray)";
}

function statusBg(s: BearingSummary["status"]) {
  if (s === "critical") return "var(--color-rose-tint)";
  if (s === "warning") return "var(--color-amber-tint)";
  if (s === "normal") return "var(--color-emerald-tint)";
  return "#f5f5f4";
}

// Group bearings by assetName
type AssetGroup = {
  name: string;
  bearings: BearingSummary[];
  worstStatus: BearingSummary["status"];
  avgFail: number;
  minRul: number;
};

function groupByAsset(bearings: BearingSummary[]): AssetGroup[] {
  const map = new Map<string, BearingSummary[]>();
  for (const b of bearings) {
    const key = b.assetName || "Unknown Asset";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  const order: BearingSummary["status"][] = ["critical", "warning", "normal", "offline"];
  return [...map.entries()].map(([name, list]) => {
    const worstStatus = list.reduce<BearingSummary["status"]>((worst, b) => {
      return order.indexOf(b.status) < order.indexOf(worst) ? b.status : worst;
    }, "offline");
    return {
      name,
      bearings: list,
      worstStatus,
      avgFail: list.reduce((s, b) => s + b.failureProbability, 0) / list.length,
      minRul: Math.min(...list.map((b) => b.rul)),
    };
  }).sort((a, b) => order.indexOf(a.worstStatus) - order.indexOf(b.worstStatus));
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

// ─── AssetsPage ───────────────────────────────────────────────────────────────

export function AssetsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    const timer = window.setInterval(() => {
      fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    }, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const bearings = useMemo(() => data?.bearings ?? [], [data?.bearings]);
  const assets = useMemo(() => groupByAsset(bearings), [bearings]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.bearings.some((b) => b.location.toLowerCase().includes(q)),
    );
  }, [assets, query]);

  const criticalAssets = assets.filter((a) => a.worstStatus === "critical").length;

  const toggle = (name: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <AppShell title="Assets" searchPlaceholder="Search assets...">
      <div className="flex flex-col gap-6 p-7 pb-20">
        {/* Stats strip */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total Assets", value: `${assets.length}` },
            { label: "Assets with Active Alerts", value: `${criticalAssets}`, color: criticalAssets > 0 ? "var(--color-rose)" : undefined },
            { label: "Last sync", value: "2 min ago" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", boxShadow: "var(--shadow-subtle)" }}
            >
              <span style={{ color: "var(--color-ash-gray)" }}>{label}:</span>
              <span className="font-semibold" style={{ color: color ?? "var(--color-slate-text)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Filter + action bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ border: "1px solid var(--color-platinum-outline)", background: "var(--color-cloud-white)", minWidth: 260 }}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--color-ash-gray)" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by asset name or location..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: "var(--color-slate-text)" }}
            />
          </div>

          <button
            className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-white"
            style={{ background: "var(--color-chartwell-blue)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Register Asset
          </button>
        </div>

        {/* Asset Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ fontSize: 13, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "var(--color-canvas-fog)" }}>
                  {["Asset Name", "Location", "Bearings", "Worst Status", "Avg Failure Risk", "Min RUL", "Actions"].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                      {bearings.length === 0 ? "Loading assets..." : "No assets found."}
                    </td>
                  </tr>
                )}
                {filteredAssets.map((asset) => {
                  const expanded = expandedAssets.has(asset.name);
                  return [
                    <tr
                      key={asset.name}
                      className="cursor-pointer transition-colors hover:bg-[#fafaf9]"
                      onClick={() => toggle(asset.name)}
                      style={{ borderBottom: expanded ? "none" : "1px solid var(--color-stone-border)" }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--color-ash-gray)" }} />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--color-ash-gray)" }} />
                          )}
                          <span className="font-medium" style={{ color: "var(--color-slate-text)" }}>{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--color-ash-gray)" }}>
                        {asset.bearings[0]?.location ?? "—"}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--color-ash-gray)" }}>
                        {asset.bearings.length} bearing{asset.bearings.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: statusBg(asset.worstStatus), color: statusColor(asset.worstStatus) }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(asset.worstStatus) }} />
                          {asset.worstStatus.charAt(0).toUpperCase() + asset.worstStatus.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--color-canvas-fog)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, asset.avgFail)}%`, background: failColor(asset.avgFail) }}
                            />
                          </div>
                          <span className="text-[12px] font-medium" style={{ color: failColor(asset.avgFail) }}>
                            {Math.round(asset.avgFail)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: "var(--color-slate-text)" }}>
                        {Math.round(asset.minRul)}h
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          className="text-xs font-medium"
                          style={{ color: "var(--color-chartwell-blue)" }}
                          onClick={(e) => { e.stopPropagation(); toggle(asset.name); }}
                        >
                          View Bearings
                        </button>
                      </td>
                    </tr>,
                    expanded && (
                      <tr key={`${asset.name}-expanded`} style={{ borderBottom: "1px solid var(--color-stone-border)" }}>
                        <td colSpan={7} className="px-5 pb-4 pt-1">
                          <div className="rounded-lg overflow-hidden" style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)" }}>
                            <table className="w-full text-left" style={{ fontSize: 12, borderCollapse: "separate", borderSpacing: 0 }}>
                              <thead>
                                <tr>
                                  {["ID", "Name", "Status", "P(fail)", "RUL", ""].map((col) => (
                                    <th key={col} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                                      style={{ color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}>
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {asset.bearings.map((b) => (
                                  <tr key={b.id} style={{ borderBottom: "1px solid var(--color-stone-border)" }}
                                    className="last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-[11px]" style={{ color: "var(--color-slate-text)" }}>{b.id}</td>
                                    <td className="px-4 py-2" style={{ color: "var(--color-slate-text)" }}>{b.name}</td>
                                    <td className="px-4 py-2">
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                        style={{ background: statusBg(b.status), color: statusColor(b.status) }}
                                      >
                                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 font-semibold" style={{ color: failColor(b.failureProbability) }}>
                                      {Math.round(b.failureProbability)}%
                                    </td>
                                    <td className="px-4 py-2" style={{ color: "var(--color-slate-text)" }}>{Math.round(b.rul)}h</td>
                                    <td className="px-4 py-2">
                                      <Link href={`/bearings/${encodeURIComponent(b.id)}`}
                                        className="text-[11px] font-medium" style={{ color: "var(--color-chartwell-blue)" }}>
                                        View →
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
