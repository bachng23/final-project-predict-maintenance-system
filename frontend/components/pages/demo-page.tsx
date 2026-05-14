"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import {
  fetchDashboard,
  fetchBearingPredictions,
  type BearingSummary,
  type TelemetryPoint,
} from "@/lib/backend-api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cycle = {
  index: number;
  timestamp: string;
  health: number;   // 0-100
  pFail: number;    // 0-100
  rul: number;      // hours
  rulNorm: number;  // 0-100 normalized for chart
};

// ─── Speed map ────────────────────────────────────────────────────────────────

const SPEED_MS: Record<string, number> = {
  "0.5×": 2000,
  "1×":   1000,
  "2×":    500,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusFromPFail(pFail: number): { label: string; color: string; bg: string } {
  if (pFail >= 70) return { label: "CRITICAL", color: "#ef4444", bg: "rgba(239,68,68,0.85)" };
  if (pFail >= 35) return { label: "WARNING",  color: "#f59e0b", bg: "#f59e0b" };
  return               { label: "NORMAL",   color: "#10b981", bg: "#10b981" };
}

function fmtTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  } catch {
    return ts;
  }
}

function xTickLabel(ts: string) {
  try {
    const d = new Date(ts);
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${m[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function buildCycles(telemetry: TelemetryPoint[]): Cycle[] {
  const sorted = [...telemetry].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const maxRul = Math.max(...sorted.map(p => p.rul), 1);
  return sorted.map((p, i) => ({
    index: i,
    timestamp: p.timestamp,
    health: +p.healthScore.toFixed(1),
    pFail: +p.failureProbability.toFixed(1),
    rul: +p.rul.toFixed(1),
    rulNorm: +(p.rul / maxRul * 100).toFixed(1),
  }));
}

// ─── SVG Chart ───────────────────────────────────────────────────────────────

function HistoryChart({ cycles, cursor }: { cycles: Cycle[]; cursor: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 360 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setSize({ w: Math.max(400, r.width), h: Math.max(220, r.height) });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const N = cycles.length;
  if (N === 0) return <div ref={wrapRef} style={{ flex: 1, minHeight: 0 }} />;

  const pad = { l: 42, r: 18, t: 12, b: 30 };
  const { w, h } = size;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  // xAt always uses N so the x-axis scale is fixed regardless of how many points are visible
  const xAt = (i: number) => pad.l + (i / Math.max(N - 1, 1)) * innerW;
  const yAt = (v: number) => pad.t + (1 - v / 100) * innerH;

  function makePath(arr: number[]) {
    if (arr.length === 0) return "";
    let d = `M ${xAt(0)} ${yAt(arr[0])}`;
    for (let i = 1; i < arr.length; i++) {
      const xp = xAt(i - 1), xc = xAt(i);
      const cx = xp + (xc - xp) * 0.5;
      d += ` C ${cx} ${yAt(arr[i - 1])} ${cx} ${yAt(arr[i])} ${xc} ${yAt(arr[i])}`;
    }
    return d;
  }
  function areaPath(arr: number[]) {
    if (arr.length === 0) return "";
    return makePath(arr) + ` L ${xAt(N - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
  }

  // Only render up to the current cursor — the chart draws progressively
  const visible = cycles.slice(0, cursor + 1);
  const healthArr  = visible.map(c => c.health);
  const pFailArr   = visible.map(c => c.pFail);
  const rulNormArr = visible.map(c => c.rulNorm);

  function onMove(e: React.MouseEvent) {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - pad.l) / innerW;
    if (ratio < 0 || ratio > 1) { setHover(null); return; }
    const idx = Math.round(ratio * (N - 1));
    // Only allow hover within the already-drawn portion
    setHover(idx <= cursor ? idx : null);
  }

  const yTicks = [0, 25, 50, 75, 100];
  // Pick ~5 evenly spaced x tick indices
  const xTickCount = Math.min(6, N);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i / (xTickCount - 1)) * (N - 1))
  );

  const hov = hover ?? cursor;

  return (
    <div
      ref={wrapRef}
      style={{ flex: 1, minHeight: 0, position: "relative" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={w} height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ba6f1" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#3ba6f1" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={yAt(v)} y2={yAt(v)}
              stroke="#e7e5e4" strokeDasharray={v === 0 ? "0" : "2 4"} />
            <text x={pad.l - 10} y={yAt(v) + 4} fontSize="10.5"
              textAnchor="end" fill="#a8a29e" fontFamily="monospace">{v}%</text>
          </g>
        ))}
        {xTicks.map(i => (
          <text key={i} x={xAt(i)} y={h - pad.b + 18}
            fontSize="10.5" textAnchor="middle" fill="#a8a29e" fontFamily="monospace">
            {xTickLabel(cycles[i].timestamp)}
          </text>
        ))}

        {/* 60% alert line */}
        <line x1={pad.l} x2={w - pad.r} y1={yAt(60)} y2={yAt(60)}
          stroke="#ef4444" strokeOpacity="0.32" strokeDasharray="4 4" strokeWidth="1" />
        <g transform={`translate(${pad.l + 6}, ${yAt(60) - 18})`}>
          <rect x="0" y="0" width="104" height="14" rx="3" fill="#fef2f2" stroke="rgba(239,68,68,0.35)" />
          <text x="6" y="10" fontSize="9.5" textAnchor="start" fill="#dc2626"
            fontFamily="monospace" fontWeight="700" letterSpacing="0.04em">
            P(F) ALERT &gt; 60%
          </text>
        </g>

        {/* Area fills */}
        <path d={areaPath(rulNormArr)} fill="url(#gR)" />
        <path d={areaPath(healthArr)}  fill="url(#gH)" />
        <path d={areaPath(pFailArr)}   fill="url(#gP)" />

        {/* Lines */}
        <path d={makePath(rulNormArr)} fill="none" stroke="#f59e0b" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        <path d={makePath(healthArr)}  fill="none" stroke="#3ba6f1" strokeWidth="2.25"
          strokeLinejoin="round" strokeLinecap="round" />
        <path d={makePath(pFailArr)}   fill="none" stroke="#ef4444" strokeWidth="2.25"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Cursor line */}
        <line x1={xAt(cursor)} x2={xAt(cursor)} y1={pad.t} y2={h - pad.b}
          stroke="#1c1917" strokeOpacity="0.85" strokeWidth="1.5" />
        <g transform={`translate(${xAt(cursor)}, ${pad.t + 2})`}>
          <rect x="-30" y="0" width="60" height="16" rx="8" fill="#1c1917" />
          <text x="0" y="11" textAnchor="middle" fill="white" fontSize="9.5"
            fontWeight="700" letterSpacing="0.08em" fontFamily="monospace">
            NOW
          </text>
        </g>
        <circle cx={xAt(cursor)} cy={yAt(healthArr[cursor])}  r="5" fill="#3ba6f1" stroke="white" strokeWidth="2" />
        <circle cx={xAt(cursor)} cy={yAt(pFailArr[cursor])}   r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
        <circle cx={xAt(cursor)} cy={yAt(rulNormArr[cursor])} r="5" fill="#f59e0b" stroke="white" strokeWidth="2" />

        {/* Hover tooltip crosshair */}
        {hover !== null && hover !== cursor && (
          <>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={h - pad.b}
              stroke="#78716c" strokeDasharray="2 3" strokeOpacity="0.55" />
            {/* Tooltip box */}
            {(() => {
              const cx = xAt(hover);
              const bx = cx + 10 > w - 140 ? cx - 124 : cx + 10;
              const by = pad.t + 4;
              return (
                <g>
                  <rect x={bx} y={by} width="114" height="58" rx="6"
                    fill="#1c1917" fillOpacity="0.92" />
                  <text x={bx + 8} y={by + 13} fontSize="9.5" fill="#a8a29e" fontFamily="monospace">
                    {xTickLabel(cycles[hover].timestamp)}
                  </text>
                  <circle cx={bx + 8} cy={by + 24} r="3.5" fill="#3ba6f1" />
                  <text x={bx + 16} y={by + 28} fontSize="10" fill="white" fontFamily="monospace">
                    {cycles[hover].health.toFixed(1)}%
                  </text>
                  <circle cx={bx + 8} cy={by + 38} r="3.5" fill="#ef4444" />
                  <text x={bx + 16} y={by + 42} fontSize="10" fill="white" fontFamily="monospace">
                    {cycles[hover].pFail.toFixed(1)}%
                  </text>
                  <circle cx={bx + 8} cy={by + 52} r="3.5" fill="#f59e0b" />
                  <text x={bx + 16} y={by + 56} fontSize="10" fill="white" fontFamily="monospace">
                    {cycles[hover].rul.toFixed(0)}h
                  </text>
                </g>
              );
            })()}
            <circle cx={xAt(hover)} cy={yAt(healthArr[hover])}  r="3.5" fill="#3ba6f1" stroke="white" strokeWidth="1.5" />
            <circle cx={xAt(hover)} cy={yAt(pFailArr[hover])}   r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.5" />
            <circle cx={xAt(hover)} cy={yAt(rulNormArr[hover])} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Negotiation feed (static) ────────────────────────────────────────────────

type AgentId = "HA" | "PA" | "CA" | "SA" | "CE";

const AVATAR_COLORS: Record<AgentId, string> = {
  HA: "#3ba6f1", PA: "#8b5cf6", CA: "#10b981", SA: "#ef4444", CE: "#1c1917",
};
const CONF_COLORS: Record<AgentId, string> = { ...AVATAR_COLORS };
const ACTION_STYLES: Record<string, React.CSSProperties> = {
  "ap-propose":      { background: "#eff6ff", color: "#2563eb" },
  "ap-critique":     { background: "#fffbeb", color: "#b45309" },
  "ap-vote-inspect": { background: "#ecfdf5", color: "#047857" },
  "ap-summary":      { background: "#1c1917", color: "white" },
};

const MONO: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 12,
  background: "#f5f4f2", border: "1px solid #e7e5e4",
  padding: "1px 5px", borderRadius: 4,
};

type FeedMsg = { id: AgentId; round: string; name: string; action: string; actionClass: string; ts: string; body: React.ReactNode; conf: number | null; final?: boolean };

const MESSAGES: FeedMsg[] = [
  { id: "HA", round: "ROUND 1", name: "Health Agent",    action: "PROPOSE",       actionClass: "ap-propose",      ts: "08:30:14",
    body: <>RUL at <code style={MONO}>48h</code>, health score <code style={MONO}>28/100</code>. Outer race fault confidence <code style={MONO}>0.89</code>. Recommend <strong>INSPECT</strong>.</>, conf: 0.82 },
  { id: "PA", round: "ROUND 1", name: "Production Agent", action: "CRITIQUE",     actionClass: "ap-critique",     ts: "08:30:15",
    body: <>Current uptime cost is high. <strong>CONTINUE</strong> preferred unless safety threshold breached.</>, conf: 0.61 },
  { id: "CA", round: "ROUND 2", name: "Cost Agent",       action: "VOTE → INSPECT", actionClass: "ap-vote-inspect", ts: "08:30:17",
    body: <>Inspection cost (<code style={MONO}>$1.8k</code>) is lower than predicted failure cost (<code style={MONO}>$42k</code>) at this RUL. <strong>INSPECT</strong> justified.</>, conf: 0.74 },
  { id: "SA", round: "ROUND 2", name: "Safety Agent",     action: "VOTE → INSPECT", actionClass: "ap-vote-inspect", ts: "08:30:18",
    body: <>P_fail <code style={MONO}>0.71</code> exceeds safety threshold <code style={MONO}>0.70</code>. <strong>INSPECT</strong> required. No veto — below <code style={MONO}>0.75</code> hard stop.</>, conf: 0.91 },
  { id: "CE", round: "SUMMARY", name: "Consensus Engine", action: "Final: INSPECT", actionClass: "ap-summary",    ts: "08:30:19",
    body: <><strong>3 of 4 agents voted INSPECT.</strong> Consensus reached. Final action: <strong>INSPECT</strong>.</>, conf: null, final: true },
];

function Message({ m }: { m: FeedMsg }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: AVATAR_COLORS[m.id], display: "grid", placeItems: "center", color: "white", fontFamily: "monospace", fontSize: 10.5, fontWeight: 700, boxShadow: "0 0 0 3px #fff", zIndex: 1, position: "relative" }}>
        {m.id}
      </div>
      <div style={{ background: m.final ? "linear-gradient(180deg,rgba(16,185,129,.07),rgba(16,185,129,.02))" : "#fff", border: `1px solid ${m.final ? "rgba(16,185,129,.3)" : "#e7e5e4"}`, borderRadius: 9, padding: "10px 12px 11px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: m.round === "SUMMARY" ? "#ecfdf5" : "#f5f4f2", color: m.round === "SUMMARY" ? "#047857" : "#78716c", border: `1px solid ${m.round === "SUMMARY" ? "rgba(16,185,129,.3)" : "#e7e5e4"}`, whiteSpace: "nowrap" }}>{m.round}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1c1917", whiteSpace: "nowrap" }}>{m.name}</span>
          <span style={{ padding: "2px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", borderRadius: 9999, whiteSpace: "nowrap", ...(ACTION_STYLES[m.actionClass] ?? {}) }}>{m.action}</span>
          <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10.5, color: "#a8a29e", whiteSpace: "nowrap" }}>{m.ts}</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#1c1917" }}>{m.body}</div>
        {m.conf !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 11, color: "#78716c" }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Confidence</span>
            <span style={{ fontWeight: 600, color: "#1c1917" }}>{m.conf.toFixed(2)}</span>
            <span style={{ flex: 1, maxWidth: 120, height: 3, background: "#f5f4f2", borderRadius: 9999, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${m.conf * 100}%`, background: CONF_COLORS[m.id], borderRadius: 9999 }} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DemoPage() {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [bearings, setBearings] = useState<BearingSummary[]>([]);
  const [selectedBearing, setSelectedBearing] = useState<BearingSummary | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(false);

  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1×");

  // Fetch bearing list on mount
  useEffect(() => {
    const ctrl = new AbortController();
    fetchDashboard(ctrl.signal)
      .then(d => {
        setBearings(d.bearings);
        if (d.bearings.length > 0) setSelectedBearing(d.bearings[0]);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Fetch telemetry when bearing changes
  useEffect(() => {
    if (!selectedBearing) return;
    const ctrl = new AbortController();
    setLoading(true);
    setPlaying(false);
    setCursor(0);
    fetchBearingPredictions(selectedBearing.apiId, selectedBearing, ctrl.signal, 200)
      .then(telemetry => {
        setCycles(buildCycles(telemetry));
        setLoading(false);
      })
      .catch(err => {
        if (err?.name !== "AbortError") setLoading(false);
      });
    return () => ctrl.abort();
  }, [selectedBearing]);

  // Scroll feed to bottom on mount
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, []);

  // Playback timer
  const advanceCursor = useCallback(() => {
    setCursor(c => {
      if (c >= cycles.length - 1) {
        setPlaying(false);
        return c;
      }
      return c + 1;
    });
  }, [cycles.length]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (playing && cycles.length > 0) {
      timerRef.current = setInterval(advanceCursor, SPEED_MS[speed] ?? 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, advanceCursor, cycles.length]);

  function handleReset() {
    setPlaying(false);
    setCursor(0);
  }

  function handleScrubClick(e: React.MouseEvent<HTMLDivElement>) {
    if (cycles.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCursor(Math.round(ratio * (cycles.length - 1)));
  }

  const N = cycles.length;
  const current = cycles[cursor] ?? null;
  const pct = N > 1 ? cursor / (N - 1) : 0;
  const status = current ? statusFromPFail(current.pFail) : { label: "—", color: "#a8a29e", bg: "#a8a29e" };

  return (
    <>
      <style>{`
        @keyframes livepulse {
          0%  { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          80% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100%{ box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes greenpulse {
          0%  { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          80% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
          100%{ box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .demo-feed-rail::before {
          content: "";
          position: absolute;
          left: 32px; top: 24px; bottom: 70px;
          width: 1px;
          background: linear-gradient(180deg, transparent 0%, #e7e5e4 8%, #e7e5e4 92%, transparent 100%);
          pointer-events: none;
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateRows: "48px 1fr 56px", height: "100vh", background: "#f5f4f2", overflow: "hidden" }}>

        {/* ── TOP BAR ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 20px", background: "#fff", borderBottom: "1px solid #e7e5e4" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifySelf: "start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#1c1917", display: "grid", placeItems: "center", position: "relative" }}>
              <Brain style={{ width: 12, height: 12, color: "white" }} />
              <span style={{ position: "absolute", width: 5, height: 5, borderRadius: "50%", background: "#3ba6f1", top: 3, right: 3, boxShadow: "0 0 0 1.5px white" }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.016em", color: "#1c1917" }}>
              Marco<span style={{ color: "#3ba6f1" }}>.</span>ai
            </span>
          </div>

          {/* Center label */}
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1c1917", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, background: "#ef4444", borderRadius: "50%", animation: "livepulse 1.6s ease-out infinite" }} />
            Live Demo
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifySelf: "end" }}>
            {/* Bearing selector */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 10px 0 12px", border: "1px solid #e7e5e4", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 500, color: "#1c1917" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 0 2px ${status.color}22` }} />
              <span style={{ color: "#78716c", fontSize: 12 }}>Bearing</span>
              <select
                value={selectedBearing?.apiId ?? ""}
                onChange={e => {
                  const b = bearings.find(x => x.apiId === e.target.value);
                  if (b) setSelectedBearing(b);
                }}
                style={{ border: 0, outline: "none", background: "transparent", fontFamily: "monospace", fontSize: 12.5, color: "#1c1917", cursor: "pointer" }}
              >
                {bearings.map(b => (
                  <option key={b.apiId} value={b.apiId}>{b.id}</option>
                ))}
              </select>
            </div>

            <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", border: "1px solid #e7e5e4", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 500, color: "#78716c", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Exit Demo
            </button>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ display: "grid", gridTemplateColumns: "58fr 42fr", gap: 14, padding: 14, minHeight: 0 }}>

          {/* Chart panel */}
          <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 10, display: "flex", flexDirection: "column", padding: "20px 22px 16px", minHeight: 0, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#1c1917" }}>Historical Prediction Trend</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#78716c", fontFamily: "monospace" }}>
                  {selectedBearing ? `${selectedBearing.id} · ${N} inference cycles` : "Loading…"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {[{ color: "#3ba6f1", label: "Health Score" }, { color: "#ef4444", label: "P(Failure)" }, { color: "#f59e0b", label: "RUL normalized" }].map(l => (
                  <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "#1c1917", fontWeight: 500, whiteSpace: "nowrap" }}>
                    <span style={{ width: 22, height: 3, borderRadius: 2, background: l.color, display: "inline-block" }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#a8a29e", fontSize: 13 }}>
                Loading bearing data…
              </div>
            ) : N === 0 ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#a8a29e", fontSize: 13 }}>
                No prediction data available for this bearing.
              </div>
            ) : (
              <HistoryChart cycles={cycles} cursor={cursor} />
            )}
          </div>

          {/* Negotiation feed (static) */}
          <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #e7e5e4", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1c1917" }}>Negotiation Feed</h2>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 7px", borderRadius: 9999, background: "#ecfdf5", color: "#047857", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", border: "1px solid rgba(16,185,129,.25)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "greenpulse 1.6s ease-out infinite" }} />
                  LIVE
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#78716c" }}>Multi-agent reasoning log · newest at bottom</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34, padding: "0 10px 0 12px", border: "1px solid #e7e5e4", borderRadius: 8, background: "#fafaf9", fontSize: 13, color: "#1c1917" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "#78716c" }}>Decision</span>
                  <span>Latest —</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>BRG-003</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "#a8a29e" }}>May 14 · 08:30</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            <div ref={feedRef} className="demo-feed-rail" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
              {MESSAGES.map(m => <Message key={m.id} m={m} />)}
            </div>

            <div style={{ borderTop: "1px solid #e7e5e4", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 12, color: "#78716c", background: "#fafaf9", flexShrink: 0, borderRadius: "0 0 10px 10px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span style={{ color: "#047857" }}>Consensus reached in 2 rounds</span>
                <span style={{ color: "#d6d3d1" }}>·</span>
                <span>5 messages</span>
              </span>
              <a href="/policy" style={{ color: "#3ba6f1", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                Open decision
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
            </div>
          </div>
        </div>

        {/* ── PLAYBACK BAR ── */}
        <div style={{ margin: "0 14px 14px", borderRadius: 14, background: "rgba(28,25,23,0.94)", backdropFilter: "blur(8px)", display: "grid", gridTemplateColumns: "auto auto auto 1fr auto", alignItems: "center", gap: 16, padding: "0 16px 0 10px", color: "#fff", height: 56, boxShadow: "rgba(0,0,0,0.2) 0 8px 24px -8px" }}>

          {/* Play / Pause */}
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pause" : "Play"}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#3ba6f1", border: 0, display: "grid", placeItems: "center", color: "white", boxShadow: "0 0 0 4px rgba(59,166,241,0.18)", cursor: "pointer" }}>
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5 L19 12 L8 19 Z" /></svg>
            )}
          </button>

          {/* Reset */}
          <button onClick={handleReset} aria-label="Reset"
            style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: 0, color: "rgba(255,255,255,0.75)", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 10 9 10" />
            </svg>
          </button>

          {/* Speed */}
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", padding: 3, borderRadius: 9999, gap: 2 }}>
            {["0.5×", "1×", "2×"].map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                style={{ border: 0, background: s === speed ? "#fff" : "transparent", color: s === speed ? "#1c1917" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 9999, minWidth: 36, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          {/* Scrubber */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "0 8px" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
              cycle {cursor + 1} / {N || "—"}
            </span>
            <div onClick={handleScrubClick}
              style={{ position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 9999 }} />
              <div style={{ position: "absolute", left: 0, top: 6, height: 4, width: `${pct * 100}%`, background: "linear-gradient(90deg,#3ba6f1,#5fb6f4)", borderRadius: 9999 }} />
              {/* Fault markers at points where pFail crosses 60% */}
              {cycles.map((c, i) =>
                i > 0 && cycles[i - 1].pFail < 60 && c.pFail >= 60 ? (
                  <div key={i} style={{ position: "absolute", left: `${(i / Math.max(N - 1, 1)) * 100}%`, width: 2, height: 10, top: 3, background: "#ef4444", borderRadius: 1, boxShadow: "0 0 0 2px rgba(239,68,68,0.18)" }} />
                ) : null
              )}
              <div style={{ position: "absolute", left: `${pct * 100}%`, width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "3px solid #3ba6f1", transform: "translateX(-7px)", boxShadow: "0 0 0 4px rgba(59,166,241,0.16),0 2px 6px rgba(0,0,0,0.3)" }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: "rgba(245,158,11,0.13)", color: "#fbbf24", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.25)" }}>
              <span style={{ color: "rgba(251,191,36,0.7)", fontWeight: 500 }}>Health</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{current ? `${current.health.toFixed(1)}%` : "—"}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: "rgba(239,68,68,0.13)", color: "#fca5a5", boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.3)" }}>
              <span style={{ color: "rgba(252,165,165,0.7)", fontWeight: 500 }}>P(Fail)</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{current ? `${current.pFail.toFixed(1)}%` : "—"}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: "rgba(245,158,11,0.13)", color: "#fbbf24", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.25)" }}>
              <span style={{ color: "rgba(251,191,36,0.7)", fontWeight: 500 }}>RUL</span>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{current ? `${current.rul.toFixed(0)}h` : "—"}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 9px", borderRadius: 9999, fontWeight: 700, letterSpacing: "0.08em", fontSize: 10.5, background: status.bg, color: current?.pFail >= 35 ? "#1c1917" : "#fff" }}>
              {status.label === "CRITICAL" ? "⛔" : status.label === "WARNING" ? "⚠" : "✓"} {status.label}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 8, marginLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
              {current ? fmtTimestamp(current.timestamp) : "—"}
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>UTC</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
