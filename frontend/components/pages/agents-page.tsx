"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Seed data ────────────────────────────────────────────────────────────────

type AgentStatus = "idle" | "processing" | "vetoed";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: "shield" | "heart" | "factory" | "calc";
  color: string;
  status: AgentStatus;
  decisions: number;
  confidence: number;
};

const AGENTS: Agent[] = [
  { id: "safety",     name: "Safety Agent",     role: "Hard-stop veto gate for all decisions",    icon: "shield",  color: "#ef4444", status: "idle",       decisions: 24, confidence: 91 },
  { id: "health",     name: "Health Agent",     role: "Assesses RUL and health-score trajectory", icon: "heart",   color: "#3ba6f1", status: "processing", decisions: 28, confidence: 82 },
  { id: "production", name: "Production Agent", role: "Weighs uptime cost — prefers CONTINUE",    icon: "factory", color: "#8b5cf6", status: "processing", decisions: 26, confidence: 73 },
  { id: "cost",       name: "Cost Agent",       role: "Calculates maintenance schedule economics",icon: "calc",    color: "#10b981", status: "idle",       decisions: 24, confidence: 78 },
];

type FeedRow = {
  round: string;
  agent: string;
  type: "PROPOSE" | "CRITIQUE" | "VOTE" | "SUMMARY" | "VETO";
  action?: string;
  time: string;
  msg: string;
  conf?: number;
};

const FEED: FeedRow[] = [
  { round: "ROUND 1", agent: "Health Agent",     type: "PROPOSE",  time: "08:30:14", msg: "RUL at 48h, health score 28/100. Outer race fault confidence 0.89. Recommend INSPECT.", conf: 0.82 },
  { round: "ROUND 1", agent: "Production Agent", type: "CRITIQUE", time: "08:30:15", msg: "Current uptime cost is high. CONTINUE preferred unless safety threshold breached.", conf: 0.61 },
  { round: "ROUND 2", agent: "Cost Agent",       type: "VOTE",     action: "INSPECT",  time: "08:30:17", msg: "Inspection cost ($1.8k) is lower than predicted failure cost ($42k) at this RUL. INSPECT justified.", conf: 0.74 },
  { round: "ROUND 2", agent: "Safety Agent",     type: "VOTE",     action: "INSPECT",  time: "08:30:18", msg: "P_fail 0.71 exceeds safety threshold 0.70. INSPECT required. No veto issued — below 0.75 hard stop.", conf: 0.91 },
  { round: "SUMMARY", agent: "Consensus Engine", type: "SUMMARY",  action: "INSPECT",  time: "08:30:19", msg: "3 of 4 agents voted INSPECT. Consensus reached. Final action: INSPECT." },
];

const RECENT_DECISIONS = [
  { label: "Latest — BRG-003, May 14 08:30" },
  { label: "BRG-007, May 14 06:12" },
  { label: "BRG-012, May 13 22:44" },
];

const AGREEMENT_LABELS = ["Safety", "Health", "Prod", "Cost"];
const AGREEMENT_MATRIX = [
  [null, 88, 61, 74],
  [88, null, 77, 82],
  [61, 77, null, 69],
  [74, 82, 69, null],
];

const OVERRIDE_RATES = [
  { agent: "Safety Agent",     pct: 4 },
  { agent: "Health Agent",     pct: 11 },
  { agent: "Production Agent", pct: 28 },
  { agent: "Cost Agent",       pct: 18 },
];

// ─── Agent icon SVGs ──────────────────────────────────────────────────────────

function AgentIcon({ kind, color, size = 18 }: { kind: Agent["icon"]; color: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "shield") return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (kind === "heart")  return <svg {...p}><path d="M3 12h3l2-5 4 10 2-5h7" /></svg>;
  if (kind === "factory")return <svg {...p}><path d="M3 21V11l5 3V11l5 3V11l5 3v-2l3 9z" /></svg>;
  if (kind === "calc")   return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2M8 19h2M12 19h2" /></svg>;
  return null;
}

// ─── Action pill ──────────────────────────────────────────────────────────────

function ActionPill({ action }: { action: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    INSPECT:  { bg: "#ecfdf5", color: "#047857" },
    CONTINUE: { bg: "#eff6ff", color: "#2563eb" },
    STOP:     { bg: "#fef2f2", color: "#dc2626" },
  };
  const s = map[action] ?? { bg: "#f5f5f4", color: "#78716c" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 9999, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", background: s.bg, color: s.color }}>
      {action}
    </span>
  );
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-block", flexShrink: 0 }}>
      <style>{`@keyframes pdm-pulse-ring { from { transform: scale(1); opacity: 0.5; } to { transform: scale(2.4); opacity: 0; } }`}</style>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      <span style={{ position: "absolute", inset: -3, borderRadius: "50%", background: color, opacity: 0.4, animation: "pdm-pulse-ring 1.6s ease-out infinite" }} />
    </span>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const isActive = agent.status === "processing";
  const statusLabel = isActive ? "ACTIVE" : agent.status === "vetoed" ? "VETO" : "IDLE";
  const statusColor = isActive ? "#3ba6f1" : agent.status === "vetoed" ? "#f43f5e" : "#a8a29e";
  const confColor = agent.confidence >= 80 ? "#10b981" : agent.confidence >= 60 ? "#f59e0b" : "#f43f5e";

  return (
    <div style={{
      background: "var(--color-cloud-white)",
      border: "1px solid var(--color-stone-border)",
      borderLeft: `3px solid ${agent.color}`,
      borderRadius: 10, padding: "12px 14px",
      position: "relative", overflow: "hidden",
    }}>
      {isActive && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at top right, ${agent.color}14 0%, transparent 60%)`, pointerEvents: "none" }} />
      )}
      {/* Status badge */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: statusColor, whiteSpace: "nowrap" }}>
        {isActive ? <PulseDot color={statusColor} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />}
        {statusLabel}
      </div>
      {/* Icon + name */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: agent.color + "14", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <AgentIcon kind={agent.icon} color={agent.color} size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 64 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-slate-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-ash-gray)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.role}</div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--color-stone-border)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--color-slate-text)" }}>{agent.decisions}</span>
          <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-ash-gray)" }}>TODAY</span>
        </div>
        <span style={{ color: "var(--color-platinum-outline)", fontSize: 11 }}>·</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.012em", color: confColor }}>{agent.confidence}%</span>
          <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-ash-gray)" }}>CONF</span>
        </div>
      </div>
    </div>
  );
}

// ─── LangGraph pipeline ───────────────────────────────────────────────────────

type NodeDef = { id: string; x: number; y: number; w: number; h: number; label: string; sub?: string; kind: string; agent?: Agent };
type EdgeDef = { from: string; to: string; active: boolean; completed: boolean; veto?: boolean; dashed?: boolean };

function LangGraph({ activeNode }: { activeNode: string }) {
  const byId = Object.fromEntries(AGENTS.map(a => [a.id, a]));
  const nodes: NodeDef[] = [
    { id: "trigger",    x: 30,  y: 216, w: 160, h: 88, label: "Anomaly Trigger",  sub: "BRG-003",       kind: "start" },
    { id: "safety",     x: 235, y: 216, w: 180, h: 88, label: "Safety Gate",      sub: "Safety Agent",  kind: "agent", agent: byId.safety },
    { id: "health",     x: 475, y: 60,  w: 180, h: 88, label: "Health Agent",     sub: "RUL · score",   kind: "agent", agent: byId.health },
    { id: "production", x: 475, y: 216, w: 180, h: 88, label: "Production Agent", sub: "Uptime cost",   kind: "agent", agent: byId.production },
    { id: "cost",       x: 475, y: 372, w: 180, h: 88, label: "Cost Agent",       sub: "Economics",     kind: "agent", agent: byId.cost },
    { id: "consensus",  x: 715, y: 216, w: 200, h: 88, label: "Consensus Engine", sub: "Vote tally",    kind: "engine" },
    { id: "output",     x: 935, y: 216, w: 160, h: 88, label: "Decision Output",  sub: "INSPECT",       kind: "end" },
    { id: "veto",       x: 235, y: 396, w: 180, h: 76, label: "Safety Veto",      sub: "STOP issued",   kind: "veto" },
  ];
  const edges: EdgeDef[] = [
    { from: "trigger",    to: "safety",     active: true,  completed: true },
    { from: "safety",     to: "health",     active: false, completed: true },
    { from: "safety",     to: "production", active: false, completed: true },
    { from: "safety",     to: "cost",       active: false, completed: true },
    { from: "safety",     to: "veto",       active: false, completed: false, veto: true, dashed: true },
    { from: "health",     to: "consensus",  active: false, completed: true },
    { from: "production", to: "consensus",  active: true,  completed: false },
    { from: "cost",       to: "consensus",  active: false, completed: true },
    { from: "consensus",  to: "output",     active: false, completed: false },
  ];

  function nodeRight(n: NodeDef): [number, number] { return [n.x + n.w, n.y + n.h / 2]; }
  function nodeLeft(n: NodeDef):  [number, number] { return [n.x, n.y + n.h / 2]; }

  function edgePath(e: EdgeDef) {
    const a = nodes.find(n => n.id === e.from)!;
    const b = nodes.find(n => n.id === e.to)!;
    let [x0, y0] = nodeRight(a);
    let [x1, y1] = nodeLeft(b);
    if (e.veto) { x0 = a.x + a.w / 2; y0 = a.y + a.h; x1 = b.x + b.w / 2; y1 = b.y; }
    const dx = x1 - x0, dy = y1 - y0;
    if (Math.abs(dy) < 3) return `M ${x0} ${y0} L ${x1} ${y1}`;
    return `M ${x0} ${y0} C ${x0 + dx * 0.5} ${y0} ${x0 + dx * 0.5} ${y1} ${x1} ${y1}`;
  }

  function nodeFill(n: NodeDef) {
    if (n.kind === "veto") return "var(--color-rose-tint)";
    if (n.id === activeNode) return "var(--color-sky-tint)";
    return "var(--color-cloud-white)";
  }
  function nodeStroke(n: NodeDef) {
    if (n.kind === "veto") return "#f43f5e";
    if (n.id === activeNode) return "#3ba6f1";
    if (n.kind === "end") return "#10b981";
    if (n.kind === "start") return "#1c1917";
    return "#e5e7eb";
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -24; } }
        @keyframes nodePulse { 0%,100% { stroke-opacity:1; } 50% { stroke-opacity:.4; } }
        .lg-edge-active { stroke-dasharray: 6 6; animation: flowDash 1s linear infinite; }
        .lg-node-active { animation: nodePulse 1.6s ease-in-out infinite; }
      `}</style>
      <svg viewBox="0 0 1120 500" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <defs>
          <marker id="arr"      markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L7 4 L0 8 Z" fill="#a8a29e" /></marker>
          <marker id="arr-blue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L7 4 L0 8 Z" fill="#3ba6f1" /></marker>
          <marker id="arr-rose" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L7 4 L0 8 Z" fill="#f43f5e" /></marker>
        </defs>

        {/* Parallel voting bracket */}
        <rect x={455} y={36} width={220} height={448} rx={12} fill="none" stroke="#e5e7eb" strokeDasharray="3 4" />
        <text x={565} y={28} fontSize="11" letterSpacing="0.08em" textAnchor="middle" fill="#a8a29e" fontWeight="600">PARALLEL VOTING (3 AGENTS)</text>

        {/* Edges */}
        {edges.map((e, i) => {
          const stroke = e.veto ? "#f43f5e" : e.active ? "#3ba6f1" : e.completed ? "#10b981" : "#d6d3d1";
          const marker = e.veto ? "url(#arr-rose)" : e.active ? "url(#arr-blue)" : "url(#arr)";
          return (
            <path key={i} d={edgePath(e)} fill="none" stroke={stroke}
              strokeWidth={e.active ? 2 : 1.4}
              strokeDasharray={e.dashed ? "4 4" : (e.active ? "6 6" : "0")}
              strokeOpacity={e.completed || e.active ? 1 : 0.5}
              className={e.active ? "lg-edge-active" : ""}
              markerEnd={marker} />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const isActive = n.id === activeNode;
          const isVeto = n.kind === "veto";
          const txtX = n.kind === "agent" || isVeto ? n.x + 44 : n.x + n.w / 2;
          const txtAnchor = n.kind === "agent" || isVeto ? "start" : "middle";
          return (
            <g key={n.id}>
              {isActive && (
                <rect x={n.x - 5} y={n.y - 5} width={n.w + 10} height={n.h + 10} rx={14}
                  fill="none" stroke="#3ba6f1" strokeOpacity="0.3" strokeWidth="1.5"
                  className="lg-node-active" />
              )}
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10}
                fill={nodeFill(n)} stroke={nodeStroke(n)}
                strokeWidth={isActive || n.kind === "veto" || n.kind === "end" || n.kind === "start" ? 1.6 : 1}
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.05))" }} />
              {/* Agent icon */}
              {n.kind === "agent" && n.agent && (
                <foreignObject x={n.x + 14} y={n.y + n.h / 2 - 11} width={22} height={22}>
                  <div style={{ display: "inline-flex" }}>
                    <AgentIcon kind={n.agent.icon} color={n.agent.color} size={20} />
                  </div>
                </foreignObject>
              )}
              {/* Status dot on agent */}
              {n.kind === "agent" && n.agent && (
                <circle cx={n.x + n.w - 14} cy={n.y + 14} r={5}
                  fill={n.agent.status === "processing" ? "#3ba6f1" : "#a8a29e"} />
              )}
              {/* Veto lock icon */}
              {isVeto && (
                <text x={n.x + 20} y={n.y + n.h / 2 + 5} fontSize="14" fill="#f43f5e" textAnchor="middle">🔒</text>
              )}
              <text x={txtX} y={n.y + n.h / 2 - 4} fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600" fill="#0c0a09" textAnchor={txtAnchor}>{n.label}</text>
              {n.sub && <text x={txtX} y={n.y + n.h / 2 + 16} fontSize="12" fill="#78716c" textAnchor={txtAnchor}>{n.sub}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Feed row ─────────────────────────────────────────────────────────────────

function FeedRow({ row }: { row: FeedRow }) {
  const agent = AGENTS.find(a => a.name === row.agent);
  const color = row.agent === "Consensus Engine" ? "#1c1917" : (agent?.color ?? "#78716c");
  const isSummary = row.type === "SUMMARY";
  const isVeto = row.type === "VETO";

  const typeBadgeStyle: React.CSSProperties = {
    PROPOSE:  { background: "#eff6ff", color: "#2563eb" },
    CRITIQUE: { background: "#fffbeb", color: "#b45309" },
    VOTE:     { background: "#ecfdf5", color: "#047857" },
    SUMMARY:  { background: "#f5f5f4", color: "#78716c" },
    VETO:     { background: "#fef2f2", color: "#dc2626" },
  }[row.type] ?? { background: "#f5f5f4", color: "#78716c" };

  const initials = row.agent.split(" ").map(w => w[0]).join("").slice(0, 2);

  return (
    <div style={{
      display: "flex", gap: 10, padding: "12px 14px",
      borderBottom: "1px solid var(--color-stone-border)",
      background: isVeto ? "var(--color-rose-tint)" : isSummary ? "var(--color-canvas-fog)" : "transparent",
    }}>
      <div style={{ background: color + "18", color, width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "monospace" }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)", padding: "2px 7px", borderRadius: 9999 }}>
            {row.round}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color, whiteSpace: "nowrap" }}>{row.agent}</span>
          <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", ...typeBadgeStyle }}>
            {row.type}
          </span>
          {row.action && (row.type === "VOTE" || row.type === "SUMMARY") && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-ash-gray)", fontSize: 11 }}>
              {row.type === "VOTE" ? "→" : "Final:"} <ActionPill action={row.action} />
            </span>
          )}
          <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10.5, color: "var(--color-ash-gray)" }}>{row.time}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-slate-text)", lineHeight: 1.55 }}>{row.msg}</div>
        {row.conf != null && (
          <div style={{ marginTop: 4, fontSize: 11, fontFamily: "monospace", color: row.conf >= 0.8 ? "#10b981" : row.conf >= 0.6 ? "#f59e0b" : "#f43f5e" }}>
            Confidence: {row.conf.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agreement matrix ─────────────────────────────────────────────────────────

function AgreementMatrix() {
  function bg(v: number | null) {
    if (v == null) return "var(--color-canvas-fog)";
    const t = v / 100;
    return `rgb(${Math.round(239 + (29 - 239) * t)},${Math.round(246 + (78 - 246) * t)},${Math.round(255 + (216 - 255) * t)})`;
  }

  return (
    <div style={{ display: "inline-block", width: "100%" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 3, margin: "0 auto" }}>
        <thead>
          <tr>
            <th />
            {AGREEMENT_LABELS.map(l => (
              <th key={l} style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ash-gray)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 6px", textAlign: "center", minWidth: 72 }}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AGREEMENT_MATRIX.map((row, i) => (
            <tr key={i}>
              <th style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ash-gray)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{AGREEMENT_LABELS[i]}</th>
              {row.map((v, j) => (
                <td key={j} style={{ width: 72, height: 56, background: bg(v), textAlign: "center", borderRadius: 6, fontFamily: "monospace", fontSize: 14, fontWeight: 500, color: v != null && v > 70 ? "#fff" : "#0c0a09", border: i === j ? "1px dashed var(--color-platinum-outline)" : "0" }}>
                  {v != null ? `${v}%` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 11, color: "var(--color-ash-gray)" }}>
        <span>Less agreement</span>
        <div style={{ display: "flex", gap: 2 }}>
          {[0, 25, 50, 75, 100].map(v => <span key={v} style={{ width: 30, height: 10, background: bg(v), borderRadius: 2, display: "inline-block" }} />)}
        </div>
        <span>More agreement</span>
      </div>
    </div>
  );
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HBarChart() {
  const max = Math.max(...OVERRIDE_RATES.map(r => r.pct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {OVERRIDE_RATES.map(r => {
        const color = r.pct < 10 ? "#10b981" : r.pct < 25 ? "#f59e0b" : "#f43f5e";
        return (
          <div key={r.agent}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12.5, color: "var(--color-slate-text)", fontWeight: 500 }}>
              <span>{r.agent}</span>
              <span style={{ fontFamily: "monospace", color }}>{r.pct}%</span>
            </div>
            <div style={{ height: 8, background: "var(--color-canvas-fog)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.pct / max) * 100}%`, background: color, borderRadius: 9999, transition: "width 0.6s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AgentsPage() {
  const [activeNode] = useState("consensus");
  const [selectedDecision, setSelectedDecision] = useState(0);

  return (
    <main style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-slate-text)" }}>
            Agent Monitor
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ash-gray)" }}>
            How the 4 agents negotiate, vote, and reach consensus.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#10b981", background: "var(--color-emerald-tint)", border: "1px solid #bbf7d0", padding: "5px 12px", borderRadius: 9999, fontWeight: 600, whiteSpace: "nowrap" }}>
            <PulseDot color="#10b981" size={7} />
            PIPELINE LIVE
          </span>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", background: "var(--color-cloud-white)", color: "var(--color-ash-gray)", border: "1px solid var(--color-stone-border)", borderRadius: 9999, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/>
            </svg>
            Replay decision
          </button>
        </div>
      </div>

      {/* Agent cards */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {AGENTS.map(a => <AgentCard key={a.id} agent={a} />)}
      </section>

      {/* Pipeline + Feed */}
      <section style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16 }}>
        {/* Pipeline */}
        <div style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", borderRadius: 10, display: "flex", flexDirection: "column", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 20px 12px", borderBottom: "1px solid var(--color-stone-border)" }}>
            <div>
              <h3 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)" }}>LangGraph Pipeline</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-ash-gray)" }}>
                Currently executing <span style={{ fontFamily: "monospace", color: "var(--color-chartwell-blue)" }}>consensus_engine</span> for decision dec_abc123 · BRG-003
              </p>
            </div>
            <div style={{ display: "inline-flex", background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", borderRadius: 9999, padding: 3, gap: 2 }}>
              {["Live", "Replay"].map((l, i) => (
                <span key={l} style={{ padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 500, background: i === 0 ? "var(--color-cloud-white)" : "transparent", color: i === 0 ? "var(--color-slate-text)" : "var(--color-ash-gray)", boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>{l}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: "12px 16px 16px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "1 1 auto", minHeight: 360, display: "flex" }}>
              <LangGraph activeNode={activeNode} />
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", paddingTop: 14, marginTop: 8, borderTop: "1px solid var(--color-stone-border)", fontSize: 11, color: "var(--color-ash-gray)" }}>
              {[
                { stroke: "#10b981", dash: "0",   label: "Completed" },
                { stroke: "#3ba6f1", dash: "4 3", label: "Flowing now", width: 2 },
                { stroke: "#d6d3d1", dash: "0",   label: "Pending" },
                { stroke: "#f43f5e", dash: "3 3", label: "Veto path (idle)" },
              ].map(l => (
                <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <svg width={20} height={2}><line x1={0} y1={1} x2={20} y2={1} stroke={l.stroke} strokeWidth={l.width ?? 1.6} strokeDasharray={l.dash} /></svg>
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Negotiation feed */}
        <div style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", borderRadius: 10, display: "flex", flexDirection: "column", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--color-stone-border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)" }}>Negotiation Feed</h3>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#10b981", fontWeight: 700, background: "var(--color-emerald-tint)", padding: "2px 9px", borderRadius: 9999, letterSpacing: "0.08em" }}>
                <PulseDot color="#10b981" size={6} /> LIVE
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-ash-gray)" }}>Multi-agent reasoning log · newest at bottom</p>
            <select
              value={selectedDecision}
              onChange={e => setSelectedDecision(Number(e.target.value))}
              style={{ width: "100%", height: 34, padding: "0 12px", border: "1px solid var(--color-stone-border)", borderRadius: 8, background: "var(--color-canvas-fog)", fontFamily: "inherit", fontSize: 13, color: "var(--color-slate-text)", outline: "none", cursor: "pointer" }}
            >
              {RECENT_DECISIONS.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
            </select>
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {FEED.map((row, i) => <FeedRow key={i} row={row} />)}
          </div>

          <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-ash-gray)", borderTop: "1px solid var(--color-stone-border)", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "var(--color-canvas-fog)" }}>
            <span>Consensus reached in 2 rounds · 5 messages</span>
            <Link href="/policy" style={{ color: "var(--color-chartwell-blue)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 11 }}>
              Open decision
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Analytics: Agreement matrix + Override rates */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--color-stone-border)" }}>
            <h3 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)" }}>Agent Agreement Rate</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-ash-gray)" }}>% of decisions where two agents voted for the same action · last 30 days</p>
          </div>
          <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
            <AgreementMatrix />
          </div>
        </div>

        <div style={{ background: "var(--color-cloud-white)", border: "1px solid var(--color-stone-border)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--color-stone-border)" }}>
            <h3 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)" }}>Human Override Rate by Agent</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-ash-gray)" }}>How often operators changed the AI recommendation each agent drove</p>
          </div>
          <div style={{ padding: 24 }}>
            <HBarChart />
            <div style={{ paddingTop: 16, borderTop: "1px solid var(--color-stone-border)", marginTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", fontSize: 11, color: "var(--color-ash-gray)", gap: 8 }}>
              {[
                { color: "#10b981", label: "<10% (trusted)" },
                { color: "#f59e0b", label: "10–25% (review)" },
                { color: "#f43f5e", label: ">25% (needs tuning)" },
              ].map(l => (
                <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
