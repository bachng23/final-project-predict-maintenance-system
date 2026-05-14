"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, List, Search as SearchIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { type BearingSummary, type DashboardData, fetchDashboard } from "@/lib/backend-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function failColor(p: number) {
  if (p >= 70) return "var(--color-rose)";
  if (p >= 35) return "var(--color-amber)";
  return "var(--color-emerald)";
}

function rulColor(r: number) {
  if (r < 24) return "var(--color-rose)";
  if (r < 72) return "var(--color-amber)";
  return "var(--color-slate-text)";
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

// Inline sparkline using SVG
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── BearingsPage ─────────────────────────────────────────────────────────────

type StatusFilter = "all" | "normal" | "warning" | "critical" | "offline";
type ViewMode = "grid" | "list";
type SortKey = "risk" | "rul" | "name";

export function BearingsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("risk");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    const timer = window.setInterval(() => {
      fetchDashboard(controller.signal).then(setData).catch(() => undefined);
    }, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const bearings = useMemo(() => data?.bearings ?? [], [data?.bearings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = bearings.filter((b) =>
      statusFilter === "all" ? true : b.status === statusFilter,
    );
    if (q) {
      list = list.filter((b) =>
        [b.id, b.name, b.assetName, b.location].some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (sort === "risk") list = [...list].sort((a, b) => b.failureProbability - a.failureProbability);
    if (sort === "rul") list = [...list].sort((a, b) => a.rul - b.rul);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [bearings, query, statusFilter, sort]);

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "normal", label: "Normal" },
    { key: "warning", label: "Warning" },
    { key: "critical", label: "Critical" },
    { key: "offline", label: "Offline" },
  ];

  return (
    <AppShell title="Bearings" searchPlaceholder="Search bearings...">
      <div className="flex flex-col gap-6 p-7 pb-20">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "var(--color-ash-gray)" }}>
            {filtered.length} bearings
          </span>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ border: "1px solid var(--color-platinum-outline)", background: "var(--color-cloud-white)", minWidth: 200 }}
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-ash-gray)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bearing ID or name..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: "var(--color-slate-text)" }}
            />
          </div>

          {/* Status pills */}
          <div
            className="inline-flex rounded-full p-0.5"
            style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)" }}
          >
            {statusPills.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: statusFilter === key ? "var(--color-cloud-white)" : "transparent",
                  color: statusFilter === key ? "var(--color-slate-text)" : "var(--color-ash-gray)",
                  boxShadow: statusFilter === key ? "var(--shadow-subtle)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md px-2.5 py-1.5 text-[13px] outline-none"
            style={{
              border: "1px solid var(--color-platinum-outline)",
              background: "var(--color-cloud-white)",
              color: "var(--color-slate-text)",
            }}
          >
            <option value="risk">By Risk ↓</option>
            <option value="rul">By RUL ↑</option>
            <option value="name">By Name A–Z</option>
          </select>

          {/* View toggle */}
          <div className="ml-auto flex" style={{ border: "1px solid var(--color-stone-border)", borderRadius: 6, overflow: "hidden" }}>
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex h-8 w-8 items-center justify-center transition-colors"
                style={{
                  background: view === v ? "var(--color-sky-tint)" : "var(--color-cloud-white)",
                  color: view === v ? "var(--color-chartwell-blue)" : "var(--color-ash-gray)",
                }}
              >
                {v === "grid" ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Grid view */}
        {view === "grid" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 && (
              <div className="col-span-3 py-16 text-center text-sm" style={{ color: "var(--color-ash-gray)" }}>
                No bearings found.
              </div>
            )}
            {filtered.map((b) => <BearingCard key={b.id} bearing={b} />)}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div
            className="overflow-hidden rounded-[10px]"
            style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", boxShadow: "var(--shadow-md)" }}
          >
            <table className="w-full text-left" style={{ fontSize: 13, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "var(--color-canvas-fog)" }}>
                  {["Bearing", "Status", "P(fail)", "RUL", "Health", "Trend 24h", ""].map((col) => (
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
                {filtered.map((b) => {
                  const sparkValues = Array.from({ length: 8 }, (_, i) =>
                    Math.max(0, Math.min(100, b.healthScore - i * 2 + Math.random() * 5)),
                  ).reverse();
                  return (
                    <tr
                      key={b.id}
                      style={{ borderBottom: "1px solid var(--color-stone-border)" }}
                      className="transition-colors hover:bg-[#fafaf9]"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: "var(--color-slate-text)" }}>{b.name}</p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-ash-gray)" }}>{b.id}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: statusBg(b.status), color: statusColor(b.status) }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(b.status) }} />
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: failColor(b.failureProbability) }}>
                        {Math.round(b.failureProbability)}%
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: rulColor(b.rul) }}>
                        {Math.round(b.rul)}h
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--color-slate-text)" }}>
                        {Math.round(b.healthScore)}/100
                      </td>
                      <td className="px-5 py-3">
                        <Sparkline values={sparkValues} color={statusColor(b.status)} />
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/bearings/${encodeURIComponent(b.id)}`}
                          className="text-xs font-medium"
                          style={{ color: "var(--color-chartwell-blue)", whiteSpace: "nowrap" }}
                        >
                          View detail →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── BearingCard ──────────────────────────────────────────────────────────────

function BearingCard({ bearing: b }: { bearing: BearingSummary }) {
  const accentColor = statusColor(b.status);

  // Synthetic 24h sparkline
  const sparkValues = Array.from({ length: 12 }, (_, i) =>
    Math.max(0, Math.min(100, b.healthScore - (11 - i) * 1.5 + Math.random() * 4)),
  );

  return (
    <div
      className="flex flex-col rounded-[10px]"
      style={{
        background: "var(--color-cloud-white)",
        border: "1px solid var(--color-stone-border)",
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="flex items-start justify-between px-4 pt-4">
        <span
          className="rounded px-2 py-0.5 font-mono text-[11px] font-medium"
          style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-slate-text)" }}
        >
          {b.id}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: statusBg(b.status), color: accentColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />
          {b.status.toUpperCase()}
        </span>
      </div>

      <div className="px-4 pt-2">
        <p className="text-[14px] font-medium" style={{ color: "var(--color-slate-text)" }}>{b.name}</p>
        <p className="text-[12px]" style={{ color: "var(--color-ash-gray)" }}>{b.location}</p>
      </div>

      <div className="mx-4 my-3" style={{ borderTop: "1px solid var(--color-stone-border)" }} />

      <div className="grid grid-cols-3 gap-2 px-4">
        <MiniMetric label="P(fail)" value={`${Math.round(b.failureProbability)}%`} color={failColor(b.failureProbability)} />
        <MiniMetric label="RUL" value={`${Math.round(b.rul)}h`} color={rulColor(b.rul)} />
        <MiniMetric label="Health" value={`${Math.round(b.healthScore)}/100`} />
      </div>

      <div className="mt-3 px-4">
        <Sparkline values={sparkValues} color={accentColor} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <Link
          href={`/bearings/${encodeURIComponent(b.id)}`}
          className="flex w-full items-center justify-center rounded-full py-1.5 text-[13px] font-medium transition-colors"
          style={{
            border: "1px solid var(--color-stone-border)",
            color: "var(--color-ash-gray)",
          }}
        >
          View Detail →
        </Link>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ash-gray)" }}>
        {label}
      </span>
      <span className="text-[15px] font-semibold" style={{ color: color ?? "var(--color-slate-text)" }}>
        {value}
      </span>
    </div>
  );
}
