"use client";

import { useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  bearingId: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export function DemoControls({ bearingId }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setError(null);
    try {
      const res = await fetch(`${API}/v1/demo/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearing_id: bearingId, speed: 1.0 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setRunning(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function stopDemo() {
    setError(null);
    try {
      await fetch(`${API}/v1/demo/stop`, { method: "POST" });
    } catch {
      // best-effort
    }
    setRunning(false);
  }

  return (
    <div className="flex items-center gap-3">
      {running ? (
        <Button size="sm" onClick={stopDemo}>
          <Square className="mr-1.5 h-3.5 w-3.5" />
          Stop demo
        </Button>
      ) : (
        <Button size="sm" variant="default" onClick={startDemo}>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Run live demo
        </Button>
      )}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
