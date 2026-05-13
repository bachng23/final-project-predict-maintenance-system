"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCcw, ShieldCheck, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  reason: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "Unknown") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unwrapDecisions(value: unknown): RawDecision[] {
  if (Array.isArray(value)) return value.filter((item): item is RawDecision => typeof item === "object" && item !== null);

  const record = asRecord(value);
  const candidates = [record.data, record.decisions, record.pending, record.items];
  const match = candidates.find(Array.isArray);

  return Array.isArray(match) ? match.filter((item): item is RawDecision => typeof item === "object" && item !== null) : [];
}

function normalizeDecision(value: RawDecision, index: number): PendingDecision {
  const pFail = asNumber(
    value.pFail ?? value.p_fail ?? value.pfail ?? value.failureProbability ?? value.failure_probability,
  );

  return {
    id: asString(value.id ?? value._id ?? value.decisionId ?? value.decision_id, `decision-${index + 1}`),
    bearingId: asString(value.bearingId ?? value.bearing_id ?? value.bearing ?? value.bearingID, "Unknown bearing"),
    pFail,
    rul: asNumber(value.rul ?? value.remainingUsefulLife ?? value.remaining_useful_life ?? value.rul_hours),
    faultType: asString(value.faultType ?? value.fault_type ?? value.fault ?? value.predictedFault, "Unclassified fault"),
    recommendedAction: asString(
      value.recommendedAction ?? value.recommended_action ?? value.action ?? value.recommendation,
      "Manual maintenance review",
    ),
  };
}

function formatProbability(value: number) {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function riskVariant(value: number): "success" | "warning" | "danger" {
  const normalized = value <= 1 ? value * 100 : value;
  if (normalized >= 70) return "danger";
  if (normalized >= 35) return "warning";
  return "success";
}

async function fetchPendingDecisions(signal?: AbortSignal): Promise<PendingDecision[]> {
  const response = await fetch("/api/decisions/pending", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/decisions/pending failed with ${response.status}`);
  }

  const raw = await response.json();
  return unwrapDecisions(raw).map(normalizeDecision);
}

async function submitDecisionAction(decisionId: string, action: DecisionAction, reason?: string) {
  const response = await fetch(`/api/decisions/${encodeURIComponent(decisionId)}/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      action,
      reason: reason?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`POST /api/decisions/${decisionId}/action failed with ${response.status}`);
  }
}

export function PolicyPage() {
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [override, setOverride] = useState<OverrideState | null>(null);

  const highRiskCount = useMemo(
    () => decisions.filter((decision) => riskVariant(decision.pFail) === "danger").length,
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
      setDecisions((current) => current.filter((item) => item.id !== decision.id));
      setOverride(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit decision action.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <AppShell title="HITL Decision Panel" searchPlaceholder="Search pending decisions...">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-5 pb-24 md:p-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Human-in-the-Loop</p>
                <h1 className="mt-2 font-headline text-3xl font-bold text-white">AI Decision Review Queue</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Review pending AI maintenance decisions before they are approved, overridden, or rejected.
                </p>
              </div>
              <Button disabled={loading} onClick={() => loadDecisions()} variant="outline">
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Review Summary</CardTitle>
              <CardDescription>Pending decisions from the AI decision service.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <SummaryItem label="Pending" value={`${decisions.length}`} />
              <SummaryItem label="High Risk" value={`${highRiskCount}`} tone="danger" />
            </CardContent>
          </Card>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center p-8 text-sm text-slate-400">
              Loading pending AI decisions...
            </CardContent>
          </Card>
        ) : decisions.length ? (
          <section className="grid gap-5 xl:grid-cols-2">
            {decisions.map((decision) => (
              <DecisionCard
                decision={decision}
                key={decision.id}
                onApprove={() => handleAction(decision, "approve")}
                onOverride={() => setOverride({ decision, reason: "" })}
                onReject={() => handleAction(decision, "reject")}
                submitting={submittingId === decision.id}
              />
            ))}
          </section>
        ) : (
          <Card>
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
              <ShieldCheck className="h-10 w-10 text-emerald-300" />
              <div>
                <p className="font-headline text-xl font-bold text-white">No pending decisions</p>
                <p className="mt-1 text-sm text-slate-400">The HITL queue is currently clear.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {override ? (
        <OverrideModal
          onClose={() => setOverride(null)}
          onReasonChange={(reason) => setOverride((current) => (current ? { ...current, reason } : current))}
          onSubmit={() => handleAction(override.decision, "override", override.reason)}
          reason={override.reason}
          submitting={submittingId === override.decision.id}
        />
      ) : null}
    </AppShell>
  );
}

function DecisionCard({
  decision,
  onApprove,
  onOverride,
  onReject,
  submitting,
}: {
  decision: PendingDecision;
  onApprove: () => void;
  onOverride: () => void;
  onReject: () => void;
  submitting: boolean;
}) {
  const variant = riskVariant(decision.pFail);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{decision.bearingId}</CardTitle>
          <CardDescription>Decision ID: {decision.id}</CardDescription>
        </div>
        <Badge variant={variant}>P_fail {formatProbability(decision.pFail)}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <DecisionField label="RUL" value={`${Math.round(decision.rul)} h`} />
          <DecisionField label="Fault Type" value={decision.faultType} />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended Action</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-100">{decision.recommendedAction}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button disabled={submitting} onClick={onApprove}>
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button disabled={submitting} onClick={onOverride} variant="outline">
            Override
          </Button>
          <Button
            className="border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
            disabled={submitting}
            onClick={onReject}
            variant="outline"
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-2 font-headline text-3xl font-bold", tone === "danger" ? "text-rose-300" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function OverrideModal({
  onClose,
  onReasonChange,
  onSubmit,
  reason,
  submitting,
}: {
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  reason: string;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-white">Override Decision</h2>
            <p className="mt-1 text-sm text-slate-400">Enter the reason for overriding the AI recommendation.</p>
          </div>
          <Button aria-label="Close override modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <textarea
          className="mt-5 min-h-32 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400"
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Reason for override..."
          value={reason}
        />

        <div className="mt-5 flex justify-end gap-3">
          <Button disabled={submitting} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={submitting || !reason.trim()} onClick={onSubmit}>
            Submit Override
          </Button>
        </div>
      </div>
    </div>
  );
}
