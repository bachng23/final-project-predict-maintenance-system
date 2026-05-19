"use client";

import { useEffect, useState } from "react";
import { Play, Square, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch, endpoint } from "@/lib/auth";

interface BearingOption {
  id: string;
  condition: string;
  files: number;
}

interface Props {
  /** Pre-select this bearing (e.g. the one currently viewed). Optional. */
  defaultBearingId?: string;
  /** Called when pipeline starts so parent can subscribe WS to the right bearing */
  onStart?: (bearingId: string) => void;
  onStop?: () => void;
}

export function DemoControls({ defaultBearingId, onStart, onStop }: Props) {
  const [bearings, setBearings] = useState<BearingOption[]>([]);
  const [selectedId, setSelectedId] = useState(defaultBearingId ?? "");
  const [speed, setSpeed] = useState(100);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBearings, setLoadingBearings] = useState(true);

  // Load available bearings + sync running state together
  useEffect(() => {
    Promise.all([
      authFetch(endpoint("/api/v1/demo/bearings")).then((r) => r.json()).catch(() => ({ bearings: [] })),
      authFetch(endpoint("/api/v1/demo/status")).then((r) => r.json()).catch(() => ({ running: false })),
    ]).then(([bearingRes, statusRes]) => {
      const list: BearingOption[] = bearingRes.bearings ?? [];
      setBearings(list);

      if (statusRes.running && statusRes.bearing_id) {
        // Resume UI state from backend
        setRunning(true);
        setSelectedId(statusRes.bearing_id);
      } else if (list.length > 0) {
        // defaultBearingId is a DB slug (e.g. BRG-001), not a dataset ID
        // → always select the first dataset bearing
        setSelectedId(list[0].id);
      }
    }).finally(() => setLoadingBearings(false));
  }, []);

  async function startDemo() {
    setError(null);
    try {
      const res = await authFetch(endpoint("/api/v1/demo/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearing_id: selectedId, speed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      setRunning(true);
      onStart?.(selectedId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function stopDemo() {
    setError(null);
    try {
      await authFetch(endpoint("/api/v1/demo/stop"), { method: "POST" });
    } catch {
      // best-effort
    }
    setRunning(false);
    onStop?.();
  }

  const selected = bearings.find((b) => b.id === selectedId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Bearing selector */}
      <div className="relative">
        <select
          className="appearance-none rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
          disabled={running || loadingBearings}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {loadingBearings && <option value="">Loading…</option>}
          {bearings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} ({b.files} files · {b.condition})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400">Speed</label>
        <select
          className="rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-2 pr-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
          disabled={running}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[30, 60, 100, 200, 500, 1000].map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>

      {/* File count hint */}
      {selected && !running && (
        <span className="text-xs text-slate-500">
          ~{Math.ceil((selected.files * 60) / speed)}s to complete
        </span>
      )}

      {/* Start / Stop */}
      {running ? (
        <Button size="sm" variant="outline" onClick={stopDemo}>
          <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
          Stop
        </Button>
      ) : (
        <Button disabled={!selectedId || loadingBearings} size="sm" onClick={startDemo}>
          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
          Run demo
        </Button>
      )}

      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
