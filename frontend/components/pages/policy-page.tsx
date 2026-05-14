"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { authFetch, endpoint } from "@/lib/auth";

// ─── Types (kept exactly from original) ───────────────────────────────────────

type DecisionAction = "approve" | "override" | "reject";
type RawDecision = Record<string, unknown>;

type PendingDecision = {
  id: string;
  bearingId: string;
  pFail: number;
  rul: number;
  faultType: string;
  recommendedAction: string;
};

type OverrideState = {
  decision: PendingDecision;
  action: string;
  reason: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown, fallback = "Unknown") {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function asNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unwrapDecisions(v: unknown): RawDecision[] {
  if (Array.isArray(v)) return v.filter((i): i is RawDecision => typeof i === "object" && i !== null);
  const r = asRecord(v);
  const candidates = [r.data, r.decisions, r.pending, r.items];
  const match = candidates.find(Array.isArray);
  return Array.isArray(match) ? match.filter((i): i is RawDecision => typeof i === "object" && i !== null) : [];
}

function normalizeDecision(v: RawDecision, idx: number): PendingDecision {
  const pFail = asNumber(v.pFail ?? v.p_fail ?? v.pfail ?? v.failureProbability ?? v.failure_probability);
  return {
    id: asString(v.id ?? v._id ?? v.decisionId ?? v.decision_id, `decision-${idx + 1}`),
    bearingId: asString(v.bearingId ?? v.bearing_id ?? v.bearing ?? v.bearingID, "Unknown bearing"),
    pFail,
    rul: asNumber(v.rul ?? v.remainingUsefulLife ?? v.remaining_useful_life ?? v.rul_hours),
    faultType: asString(v.faultType ?? v.fault_type ?? v.fault ?? v.predictedFault, "Unclassified fault"),
    recommendedAction: asString(
      v.recommendedAction ?? v.recommended_action ?? v.action ?? v.recommendation,
      "Manual maintenance review",
    ),
  };
}

async function fetchPendingDecisions(signal?: AbortSignal): Promise<PendingDecision[]> {
  const response = await authFetch(endpoint("/api/v1/decisions/pending"), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`GET /api/v1/decisions/pending failed with ${response.status}`);
  const raw = await response.json();
  return unwrapDecisions(raw).map(normalizeDecision);
}

async function submitDecisionAction(decisionId: string, action: DecisionAction, reason?: string) {
  const response = await authFetch(endpoint(`/api/v1/decisions/${encodeURIComponent(decisionId)}/action`), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action, reason: reason?.trim() || undefined }),
  });
  if (!response.ok) throw new Error(`POST /api/v1/decisions/${decisionId}/action failed with ${response.status}`);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function pFailNorm(v: number) {
  return v <= 1 ? v * 100 : v;
}

function priorityOf(pFail: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const n = pFailNorm(pFail);
  if (n >= 70) return "CRITICAL";
  if (n >= 50) return "HIGH";
  if (n >= 35) return "MEDIUM";
  return "LOW";
}

function priorityColor(p: string) {
  if (p === "CRITICAL") return "var(--color-rose)";
  if (p === "HIGH") return "var(--color-amber)";
  if (p === "MEDIUM") return "var(--color-chartwell-blue)";
  return "var(--color-steel-gray)";
}

function priorityBg(p: string) {
  if (p === "CRITICAL") return "var(--color-rose-tint)";
  if (p === "HIGH") return "var(--color-amber-tint)";
  if (p === "MEDIUM") return "var(--color-blue-tint)";
  return "#f5f5f4";
}

function actionColor(a: string) {
  const u = a.toUpperCase();
  if (u.includes("STOP")) return { bg: "var(--color-rose-tint)", color: "var(--color-rose)" };
  if (u.includes("MAINTAIN")) return { bg: "var(--color-amber-tint)", color: "var(--color-amber)" };
  if (u.includes("INSPECT")) return { bg: "var(--color-blue-tint)", color: "var(--color-chartwell-blue)" };
  return { bg: "var(--color-emerald-tint)", color: "var(--color-emerald)" };
}

// ─── PolicyPage ───────────────────────────────────────────────────────────────

type Tab = "pending" | "resolved";

export function PolicyPage() {
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [resolved, setResolved] = useState<(PendingDecision & { result: string; resolvedBy: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [override, setOverride] = useState<OverrideState | null>(null);
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [autoRefresh] = useState(true);

  const criticalCount = useMemo(
    () => decisions.filter((d) => priorityOf(d.pFail) === "CRITICAL").length,
    [decisions],
  );

  const loadDecisions = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchPendingDecisions(signal);
      setDecisions(pending);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Unable to load pending decisions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadDecisions(controller.signal);
    return () => controller.abort();
  }, []);

  const handleAction = async (decision: PendingDecision, action: DecisionAction, reason?: string) => {
    setSubmittingId(decision.id);
    setError(null);
    try {
      await submitDecisionAction(decision.id, action, reason);
      setDecisions((cur) => cur.filter((d) => d.id !== decision.id));
      setResolved((cur) => [
        ...cur,
        {
          ...decision,
          result: action === "approve" ? "APPROVED" : action === "override" ? "OVERRIDDEN" : "REJECTED",
          resolvedBy: "operator_01",
        },
      ]);
      setOverride(null);
      setExpandedOverride(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit decision action.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <AppShell title="Decision Queue" searchPlaceholder="Search decisions...">
      <div className="flex flex-col gap-5 p-7 pb-20">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3">
          <SummaryPill
            label={`${decisions.length} Pending`}
            bg="var(--color-amber-tint)"
            color="var(--color-amber)"
          />
          <SummaryPill
            label={`${criticalCount} Critical Priority`}
            bg="var(--color-rose-tint)"
            color="var(--color-rose)"
          />
          <div className="ml-auto flex items-center gap-2 text-sm" style={{ color: "var(--color-ash-gray)" }}>
            <span>Auto-refresh</span>
            <span
              className="h-5 w-9 rounded-full p-0.5 transition-colors"
              style={{ background: autoRefresh ? "var(--color-chartwell-blue)" : "var(--color-platinum-outline)" }}
            >
              <span
                className="block h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: autoRefresh ? "translateX(16px)" : "translateX(0)" }}
              />
            </span>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadDecisions()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
            style={{ border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)", background: "var(--color-cloud-white)" }}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "var(--color-rose-tint)", color: "var(--color-rose)", border: "1px solid #fecdd3" }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-6" style={{ borderBottom: "1px solid var(--color-stone-border)" }}>
          {([
            { key: "pending" as Tab, label: "Pending", count: decisions.length },
            { key: "resolved" as Tab, label: "Resolved", count: resolved.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 border-b-2 pb-2.5 text-[14px] font-medium"
              style={{
                borderBottomColor: tab === key ? "var(--color-chartwell-blue)" : "transparent",
                color: tab === key ? "var(--color-slate-text)" : "var(--color-ash-gray)",
                marginBottom: -1,
              }}
            >
              {label}
              <span
                className="rounded-full px-1.5 py-px text-[11px]"
                style={{
                  background: tab === key ? "var(--color-sky-tint)" : "var(--color-canvas-fog)",
                  color: tab === key ? "var(--color-chartwell-blue)" : "var(--color-ash-gray)",
                  border: "1px solid var(--color-stone-border)",
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Pending tab */}
        {tab === "pending" && (
          <>
            {loading ? (
              <EmptyState message="Loading pending AI decisions..." />
            ) : decisions.length === 0 ? (
              <EmptyState message="Queue is clear — no pending decisions." icon="✓" />
            ) : (
              <div className="flex flex-col gap-4">
                {decisions.map((decision) => {
                  const priority = priorityOf(decision.pFail);
                  const isExpanded = expandedOverride === decision.id;
                  const submitting = submittingId === decision.id;
                  const ac = actionColor(decision.recommendedAction);
                  const pNorm = pFailNorm(decision.pFail);

                  return (
                    <div
                      key={decision.id}
                      style={{
                        background: "var(--color-cloud-white)",
                        border: "1px solid var(--color-stone-border)",
                        borderLeft: `3px solid ${priorityColor(priority)}`,
                        borderRadius: 10,
                        boxShadow: "var(--shadow-md)",
                      }}
                    >
                      {/* Card header */}
                      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: priorityBg(priority), color: priorityColor(priority) }}
                        >
                          {priority}
                        </span>
                        <span className="flex-1 text-[15px] font-medium" style={{ color: "var(--color-slate-text)" }}>
                          {decision.bearingId}
                        </span>
                        <span className="text-xs" style={{ color: "var(--color-ash-gray)" }}>
                          Decision #{decision.id.slice(-6)}
                        </span>
                      </div>

                      {/* Data row */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 px-5 text-[13px]">
                        <span className="font-semibold" style={{ color: pNorm >= 70 ? "var(--color-rose)" : pNorm >= 35 ? "var(--color-amber)" : "var(--color-emerald)" }}>
                          P(fail): {Math.round(pNorm)}%
                        </span>
                        <span style={{ color: "var(--color-platinum-outline)" }}>·</span>
                        <span style={{ color: "var(--color-slate-text)" }}>
                          RUL: {Math.round(decision.rul)} hrs
                        </span>
                        <span style={{ color: "var(--color-platinum-outline)" }}>·</span>
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                          style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
                        >
                          {decision.faultType}
                        </span>
                      </div>

                      {/* AI recommendation */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 px-5">
                        <span className="text-[13px]" style={{ color: "var(--color-ash-gray)" }}>AI Recommends:</span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: ac.bg, color: ac.color }}
                        >
                          {decision.recommendedAction.toUpperCase()}
                        </span>
                        <span className="text-[13px]" style={{ color: "var(--color-ash-gray)" }}>Safety Veto:</span>
                        <span className="text-[13px]" style={{ color: "var(--color-steel-gray)" }}>None</span>
                      </div>

                      {/* Reason */}
                      <p className="mt-3 px-5 text-[13px] italic" style={{ color: "var(--color-ash-gray)" }}>
                        Failure probability at {Math.round(pNorm)}%. Fault type: {decision.faultType}. Recommended action based on current sensor readings.
                      </p>

                      {/* Override panel */}
                      {isExpanded && (
                        <div className="mx-5 mt-4 rounded-lg p-4"
                          style={{ background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)" }}>
                          <p className="mb-3 text-[14px] font-medium" style={{ color: "var(--color-slate-text)" }}>
                            Override AI Recommendation
                          </p>
                          <div className="mb-3">
                            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-slate-text)" }}>
                              Select action:
                            </label>
                            <select
                              value={override?.action ?? "INSPECT"}
                              onChange={(e) => setOverride((cur) => cur ? { ...cur, action: e.target.value } : null)}
                              className="rounded-md px-3 py-1.5 text-[13px] outline-none"
                              style={{ border: "1px solid var(--color-platinum-outline)", background: "var(--color-cloud-white)", color: "var(--color-slate-text)" }}
                            >
                              {["CONTINUE", "INSPECT", "MAINTAIN", "STOP"].map((a) => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </select>
                          </div>
                          <div className="mb-2">
                            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-slate-text)" }}>
                              Override reason (required):
                            </label>
                            <textarea
                              value={override?.reason ?? ""}
                              onChange={(e) => setOverride((cur) => cur ? { ...cur, reason: e.target.value } : null)}
                              placeholder="Explain why you are overriding the AI recommendation..."
                              rows={3}
                              className="w-full resize-none rounded-md px-3 py-2 text-[13px] outline-none"
                              style={{ border: "1px solid var(--color-platinum-outline)", background: "var(--color-cloud-white)", color: "var(--color-slate-text)" }}
                            />
                            <p className="mt-1 text-right text-[11px]" style={{ color: "var(--color-ash-gray)" }}>
                              {(override?.reason ?? "").length} / 500
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={submitting || (override?.reason?.trim().length ?? 0) < 10}
                              onClick={() => handleAction(decision, "override", override?.reason)}
                              className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
                              style={{ background: "var(--color-amber)" }}
                            >
                              Submit Override
                            </button>
                            <button
                              onClick={() => { setExpandedOverride(null); setOverride(null); }}
                              className="text-[13px]" style={{ color: "var(--color-ash-gray)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div
                        className="flex flex-wrap gap-2 px-5 py-4 mt-4"
                        style={{ borderTop: "1px solid var(--color-stone-border)" }}
                      >
                        <button
                          disabled={submitting}
                          onClick={() => handleAction(decision, "approve")}
                          className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
                          style={{ background: "var(--color-chartwell-blue)" }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          disabled={submitting}
                          onClick={() => {
                            setExpandedOverride(isExpanded ? null : decision.id);
                            setOverride({ decision, action: "INSPECT", reason: "" });
                          }}
                          className="rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-50"
                          style={{ border: "1px solid var(--color-amber)", color: "var(--color-amber)", background: "transparent" }}
                        >
                          ⚡ Override {isExpanded ? "▲" : "▾"}
                        </button>
                        <button
                          disabled={submitting}
                          onClick={() => handleAction(decision, "reject")}
                          className="rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-50"
                          style={{ border: "1px solid var(--color-rose)", color: "var(--color-rose)", background: "transparent" }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Resolved tab */}
        {tab === "resolved" && (
          <>
            {resolved.length === 0 ? (
              <EmptyState message="No resolved decisions yet." />
            ) : (
              <div className="flex flex-col gap-4">
                {resolved.map((d) => {
                  const priority = priorityOf(d.pFail);
                  const resultColor =
                    d.result === "APPROVED" ? "var(--color-emerald)" :
                    d.result === "OVERRIDDEN" ? "var(--color-amber)" : "var(--color-rose)";
                  const resultBg =
                    d.result === "APPROVED" ? "var(--color-emerald-tint)" :
                    d.result === "OVERRIDDEN" ? "var(--color-amber-tint)" : "var(--color-rose-tint)";

                  return (
                    <div
                      key={d.id}
                      className="opacity-80"
                      style={{
                        background: "var(--color-canvas-fog)",
                        border: "1px solid var(--color-stone-border)",
                        borderLeft: `3px solid ${priorityColor(priority)}`,
                        borderRadius: 10,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-3 p-5">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: priorityBg(priority), color: priorityColor(priority) }}
                        >
                          {priority}
                        </span>
                        <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--color-slate-text)" }}>
                          {d.bearingId}
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
                          style={{ background: resultBg, color: resultColor }}
                        >
                          {d.result === "APPROVED" ? "✓" : d.result === "OVERRIDDEN" ? "⚡" : "✕"}
                          {" "}{d.result} by {d.resolvedBy}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryPill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[13px] font-medium"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-[10px] py-16 text-center"
      style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", boxShadow: "var(--shadow-md)" }}
    >
      {icon && <span className="text-3xl" style={{ color: "var(--color-emerald)" }}>{icon}</span>}
      <p className="text-sm" style={{ color: "var(--color-ash-gray)" }}>{message}</p>
    </div>
  );
}
