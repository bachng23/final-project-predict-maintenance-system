"use client";

import { useState, type ReactNode } from "react";
import {
  User, Lock, Settings, Cpu, Bell, Check,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";

// ── CSS helpers ───────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "var(--color-cloud-white)",
  border: "1px solid var(--color-stone-border)",
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};
const CARD_HEAD: React.CSSProperties = {
  padding: "16px 24px",
  borderBottom: "1px solid var(--color-stone-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const MONO: React.CSSProperties = { fontFamily: "ui-monospace, 'SF Mono', monospace" };

// ── Shared atoms ──────────────────────────────────────────────────────────────

function TextInput({
  value, onChange, placeholder, type = "text", readOnly, style,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  type?: string; readOnly?: boolean; style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        height: 36, padding: "0 12px",
        border: "1px solid var(--color-platinum-outline)",
        borderRadius: 6,
        background: readOnly ? "var(--color-canvas-fog)" : "var(--color-cloud-white)",
        color: readOnly ? "var(--color-ash-gray)" : "var(--color-slate-text)",
        fontFamily: "inherit", fontSize: 13.5,
        outline: "none", width: "100%",
        cursor: readOnly ? "default" : "text",
        ...style,
      }}
    />
  );
}

function SelectInput({
  value, onChange, options, style,
}: {
  value: string; onChange: (v: string) => void;
  options: (string | [string, string])[]; style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 36, padding: "0 30px 0 12px",
        border: "1px solid var(--color-platinum-outline)",
        borderRadius: 6, background: "var(--color-cloud-white)",
        color: "var(--color-slate-text)", fontFamily: "inherit", fontSize: 13.5,
        outline: "none", appearance: "none", WebkitAppearance: "none",
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        ...style,
      }}
    >
      {options.map((o) => {
        const [val, lbl] = Array.isArray(o) ? o : [o, o];
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  );
}

function FieldRow({
  label, hint, children, layout = "col",
}: {
  label: string; hint?: string; children: ReactNode; layout?: "col" | "row";
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: layout === "row" ? "row" : "column",
      alignItems: layout === "row" ? "center" : "stretch",
      justifyContent: layout === "row" ? "space-between" : "flex-start",
      gap: layout === "row" ? 16 : 6,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: layout === "row" ? 220 : undefined }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-text)" }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: "var(--color-ash-gray)", lineHeight: 1.4 }}>{hint}</span>}
      </div>
      <div style={{ flex: layout === "row" ? "0 0 auto" : "1 1 auto", minWidth: layout === "row" ? 240 : 0, display: "flex", alignItems: "center", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function FieldGroup({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.filter(Boolean).map((child, i) => (
        <div key={i}>
          {i > 0 && <hr style={{ border: 0, borderTop: "1px solid var(--color-stone-border)", margin: "0 0 14px" }} />}
          {child}
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 40, height: 22, borderRadius: 9999,
        background: on ? "var(--color-chartwell-blue)" : "var(--color-platinum-outline)",
        border: 0, cursor: "pointer", flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

function SegmentedControl({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div style={{
      display: "inline-flex", borderRadius: 9999, padding: 3,
      background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)",
    }}>
      {options.map(([id, lbl]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            borderRadius: 9999, padding: "5px 14px", fontSize: 12.5, fontWeight: 500,
            background: value === id ? "var(--color-cloud-white)" : "transparent",
            color: value === id ? "var(--color-slate-text)" : "var(--color-ash-gray)",
            border: 0, cursor: "pointer",
            boxShadow: value === id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "background 0.12s",
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

function RangeSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ flex: 1, accentColor: color ?? "var(--color-chartwell-blue)", height: 4, cursor: "pointer" }}
      />
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 56, padding: "4px 10px",
        background: color ? color + "18" : "var(--color-blue-tint)",
        color: color ?? "var(--color-chartwell-blue)",
        border: `1px solid ${color ? color + "40" : "#bfdbfe"}`,
        borderRadius: 9999, fontSize: 12.5, fontWeight: 600, ...MONO,
      }}>
        {value}%
      </span>
    </div>
  );
}

function OptionCards({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void;
  options: { id: string; title: string; desc: string }[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id} type="button" onClick={() => onChange(o.id)}
            style={{
              textAlign: "left", padding: "14px 16px",
              border: `1px solid ${active ? "var(--color-chartwell-blue)" : "var(--color-stone-border)"}`,
              borderRadius: 8,
              background: active ? "var(--color-sky-tint)" : "var(--color-cloud-white)",
              cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
              transition: "background 0.12s, border 0.12s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-slate-text)" }}>{o.title}</span>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: `1.5px solid ${active ? "var(--color-chartwell-blue)" : "var(--color-platinum-outline)"}`,
                background: active ? "var(--color-chartwell-blue)" : "transparent",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--color-ash-gray)", lineHeight: 1.4 }}>{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsCard({
  title, subtitle, children, action,
}: {
  title: string; subtitle?: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <section style={CARD}>
      <div style={CARD_HEAD}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-slate-text)", margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12.5, color: "var(--color-ash-gray)", margin: "3px 0 0" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: "20px 24px 22px" }}>{children}</div>
    </section>
  );
}

function PrimaryBtn({ children, onClick, small }: { children: ReactNode; onClick?: () => void; small?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: small ? "5px 12px" : "7px 16px",
        background: "var(--color-chartwell-blue)", color: "#fff",
        border: 0, borderRadius: 9999, fontSize: small ? 12.5 : 13.5,
        fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, danger }: { children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 12px",
        background: "transparent",
        color: danger ? "var(--color-rose)" : "var(--color-ash-gray)",
        border: `1px solid ${danger ? "#fecdd3" : "var(--color-stone-border)"}`,
        borderRadius: 6, fontSize: 12.5, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

// ── Tab: Profile ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const [name, setName] = useState("Bach Nguyen");
  const [email, setEmail] = useState("bach.n@marco.ai");

  return (
    <SettingsCard
      title="Profile"
      subtitle="Update how you appear across the Marco.ai workspace."
      action={<PrimaryBtn small><Check size={12} /> Save changes</PrimaryBtn>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, alignItems: "start" }}>
        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8 }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, #3ba6f1 0%, #1c1917 100%)",
            display: "grid", placeItems: "center",
            color: "#fff", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10)",
          }}>BN</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
            <span style={{
              display: "inline-block", marginTop: 4,
              fontSize: 10, letterSpacing: "0.08em", fontWeight: 700,
              background: "var(--color-slate-text)", color: "#fff",
              padding: "2px 9px", borderRadius: 9999,
            }}>ADMIN</span>
          </div>
          <button type="button" style={{ fontSize: 12.5, color: "var(--color-chartwell-blue)", background: "none", border: 0, cursor: "pointer", fontWeight: 500 }}>
            Change photo
          </button>
        </div>

        {/* Fields */}
        <FieldGroup>
          <FieldRow label="Full Name" layout="row">
            <TextInput value={name} onChange={setName} style={{ width: 280 }} />
          </FieldRow>
          <FieldRow label="Email" layout="row">
            <TextInput type="email" value={email} onChange={setEmail} style={{ width: 280 }} />
          </FieldRow>
          <FieldRow label="Username" hint="Username is set by your administrator." layout="row">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 6,
              background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)",
              ...MONO, fontSize: 13, color: "var(--color-slate-text)", minWidth: 280,
            }}>
              <Lock size={11} color="var(--color-ash-gray)" /> bach_admin
            </span>
          </FieldRow>
          <FieldRow label="Role" hint="To change your role, contact your administrator." layout="row">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 11px", borderRadius: 9999,
              background: "var(--color-slate-text)", color: "#fff",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
            }}>ADMIN</span>
          </FieldRow>
        </FieldGroup>
      </div>
    </SettingsCard>
  );
}

// ── Tab: Security (Sessions) ──────────────────────────────────────────────────

function SecurityTab() {
  const sessions = [
    { device: "MacBook Pro", browser: "Safari 17", location: "Ho Chi Minh City, VN", last: "Just now", current: true },
    { device: "iPhone 15", browser: "Marco.ai iOS app", location: "Ho Chi Minh City, VN", last: "2 hours ago", current: false },
    { device: "Chrome on Windows", browser: "Chrome 129", location: "Hanoi, VN", last: "3 days ago", current: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SettingsCard title="Active Sessions" subtitle="Devices and browsers currently signed in to your account.">
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              {["Device", "Location", "Last active", ""].map((h) => (
                <th key={h} style={{
                  padding: "0 12px 10px", textAlign: h === "" ? "right" : "left",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--color-stone-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)",
                      display: "grid", placeItems: "center", color: "var(--color-ash-gray)", flexShrink: 0,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                        {s.device}
                        {s.current && (
                          <span style={{
                            fontSize: 10, letterSpacing: "0.06em", fontWeight: 700,
                            background: "var(--color-emerald-tint)", color: "#065f46",
                            padding: "1px 8px", borderRadius: 9999,
                          }}>THIS DEVICE</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-ash-gray)" }}>{s.browser}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px", color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}>{s.location}</td>
                <td style={{ padding: "12px", color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-stone-border)" }}>{s.last}</td>
                <td style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid var(--color-stone-border)" }}>
                  {s.current ? <span style={{ fontSize: 12, color: "var(--color-ash-gray)" }}>—</span> : <GhostBtn danger>Revoke</GhostBtn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "14px 12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--color-ash-gray)" }}>Revoking a session immediately signs that device out of Marco.ai.</span>
          <button type="button" style={{ background: "none", border: 0, cursor: "pointer", color: "var(--color-rose)", fontSize: 13, fontWeight: 500, padding: "4px 8px", borderRadius: 6 }}>
            Revoke all other sessions
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Account Info" subtitle="Read-only details — set by your administrator.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <FieldRow label="Username" layout="row">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", ...MONO, fontSize: 13, color: "var(--color-slate-text)" }}>
              bach_admin
            </span>
          </FieldRow>
          <FieldRow label="Role" layout="row">
            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 9999, background: "var(--color-slate-text)", color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>ADMIN</span>
          </FieldRow>
          <FieldRow label="Account created" layout="row">
            <span style={{ fontSize: 13 }}>Jan 8, 2025</span>
          </FieldRow>
          <FieldRow label="Last login" layout="row">
            <span style={{ fontSize: 13 }}>Just now · Safari on MacBook Pro</span>
          </FieldRow>
        </div>
        <div style={{
          marginTop: 18, padding: "10px 14px",
          background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)",
          borderRadius: 6, fontSize: 12, color: "var(--color-ash-gray)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <Lock size={13} /> To change your password or role, contact your administrator.
        </div>
      </SettingsCard>
    </div>
  );
}

// ── Tab: System ───────────────────────────────────────────────────────────────

function SystemTab() {
  const [systemName, setSystemName] = useState("Marco.ai Production");
  const [timezone, setTimezone] = useState("UTC+07:00");
  const [freq, setFreq] = useState("continuous");
  const [retention, setRetention] = useState("90d");
  const [pFail, setPFail] = useState(70);
  const [warn, setWarn] = useState(35);
  const [criticalOn, setCriticalOn] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SettingsCard title="General" subtitle="Workspace-wide system configuration.">
        <FieldGroup>
          <FieldRow label="System Name" hint="Shown in alerts and exported reports." layout="row">
            <TextInput value={systemName} onChange={setSystemName} style={{ width: 280 }} />
          </FieldRow>
          <FieldRow label="Timezone" hint="All timestamps and schedules use this zone." layout="row">
            <SelectInput value={timezone} onChange={setTimezone} options={["UTC+07:00", "UTC+00:00", "UTC-05:00", "UTC-08:00"]} style={{ width: 280 }} />
          </FieldRow>
          <FieldRow label="Inference Frequency" hint="How often the AI re-evaluates each bearing." layout="row">
            <SegmentedControl value={freq} onChange={setFreq} options={[["continuous", "Continuous"], ["hourly", "Hourly"], ["daily", "Daily"]]} />
          </FieldRow>
          <FieldRow label="Data Retention" hint="Sensor and decision history older than this is archived." layout="row">
            <SelectInput value={retention} onChange={setRetention} options={[["30d", "30 days"], ["90d", "90 days"], ["1y", "1 year"]]} style={{ width: 280 }} />
          </FieldRow>
        </FieldGroup>
      </SettingsCard>

      <SettingsCard title="Alert Thresholds" subtitle="Tune when the system raises a warning or critical alert.">
        <FieldGroup>
          <FieldRow label="Failure Probability Trigger" hint="P(fail) at which an alert escalates to CRITICAL.">
            <RangeSlider value={pFail} onChange={setPFail} color={pFail >= 70 ? "#f43f5e" : pFail >= 35 ? "#f59e0b" : "#10b981"} />
          </FieldRow>
          <FieldRow label="Warning Threshold" hint="P(fail) at which an alert moves from NORMAL to WARNING.">
            <RangeSlider value={warn} onChange={setWarn} color={warn >= 70 ? "#f43f5e" : warn >= 35 ? "#f59e0b" : "#10b981"} />
          </FieldRow>
          <FieldRow label="Critical Anomalies" hint="Immediate alerts for critical events (P_fail above hard threshold)." layout="row">
            <Toggle on={criticalOn} onChange={setCriticalOn} />
          </FieldRow>
          <FieldRow label="Auto-escalate to Decision Queue" hint="When triggered, push the bearing onto the Decision Queue automatically." layout="row">
            <Toggle on={autoEscalate} onChange={setAutoEscalate} />
          </FieldRow>
        </FieldGroup>
      </SettingsCard>
    </div>
  );
}

// ── Tab: AI & Model ───────────────────────────────────────────────────────────

function ModelTab() {
  const [confidence, setConfidence] = useState("balanced");
  const [reasoning, setReasoning] = useState("balanced");

  const confidenceOpts = [
    { id: "precise", title: "Precise", desc: "Conservative — high-confidence votes only." },
    { id: "balanced", title: "Balanced", desc: "Default mix of precision and recall." },
    { id: "exploratory", title: "Exploratory", desc: "Surfaces edge cases for engineer review." },
  ];
  const reasoningOpts = [
    { id: "precise", title: "Precise", desc: "Short chains, single-step reasoning." },
    { id: "balanced", title: "Balanced", desc: "Up to 3 negotiation rounds per decision." },
    { id: "exploratory", title: "Exploratory", desc: "Full multi-agent debate with critiques." },
  ];
  const pipeline = [
    { name: "Signal Processor", status: "healthy", latency: 8 },
    { name: "Predictor", status: "healthy", latency: 12 },
    { name: "Anomaly Detector", status: "degraded", latency: 87 },
    { name: "Orchestrator", status: "healthy", latency: 4 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SettingsCard title="Model Configuration" subtitle="The model that produces failure-probability and RUL predictions.">
        <FieldGroup>
          <FieldRow label="Model Version" hint="Trained on the XJTU-SY rotating machinery dataset." layout="row">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 9999, background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", fontSize: 12.5, ...MONO, whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              v3.4.1 · XJTU-SY
              <span style={{ color: "#10b981", fontWeight: 600 }}>Active</span>
            </span>
          </FieldRow>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>Decision Confidence Profile</div>
            <div style={{ fontSize: 11.5, color: "var(--color-ash-gray)", marginBottom: 10 }}>How aggressively the AI commits to a recommendation.</div>
            <OptionCards value={confidence} onChange={setConfidence} options={confidenceOpts} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>Reasoning Mode</div>
            <div style={{ fontSize: 11.5, color: "var(--color-ash-gray)", marginBottom: 10 }}>How much multi-agent negotiation runs before a final action is chosen.</div>
            <OptionCards value={reasoning} onChange={setReasoning} options={reasoningOpts} />
          </div>
        </FieldGroup>
      </SettingsCard>

      <SettingsCard title="Pipeline" subtitle="Live status of the inference pipeline stages.">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {pipeline.map((p, i) => {
            const ok = p.status === "healthy";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: i === pipeline.length - 1 ? "none" : "1px solid var(--color-stone-border)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>{p.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 9999, background: ok ? "var(--color-emerald-tint)" : "var(--color-amber-tint)", color: ok ? "#065f46" : "#92400e", border: `1px solid ${ok ? "#bbf7d0" : "#fde68a"}`, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>
                  {ok ? "HEALTHY" : "DEGRADED"}
                </span>
                <span style={{ ...MONO, fontSize: 12, color: "var(--color-ash-gray)", background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", padding: "2px 8px", borderRadius: 4, minWidth: 56, textAlign: "center" }}>
                  {p.latency}ms
                </span>
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [emailOn, setEmailOn] = useState(true);
  const [emailAddr, setEmailAddr] = useState("bach.n@marco.ai");
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertWarning, setAlertWarning] = useState(true);
  const [alertDecision, setAlertDecision] = useState(true);
  const [alertPipeline, setAlertPipeline] = useState(false);

  const alertRows = [
    { label: "Critical bearing alert", hint: "P(fail) > 70%, OUTER_RACE/INNER_RACE fault detected, or RUL < 24h.", color: "#f43f5e", on: alertCritical, set: setAlertCritical },
    { label: "Warning threshold", hint: "P(fail) crosses 35% or vibration RMS exceeds baseline by 50%.", color: "#f59e0b", on: alertWarning, set: setAlertWarning },
    { label: "Decision queue item", hint: "A new pending decision is added that requires your role.", color: "#3ba6f1", on: alertDecision, set: setAlertDecision },
    { label: "Pipeline failure", hint: "An inference stage is degraded or offline for more than 5 minutes.", color: "#1c1917", on: alertPipeline, set: setAlertPipeline },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SettingsCard title="Alert Channels" subtitle="Choose how Marco.ai reaches you when something needs attention.">
        <FieldGroup>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Email notifications" hint="Receive an email when any of the alert types below trigger." layout="row">
              <Toggle on={emailOn} onChange={setEmailOn} />
            </FieldRow>
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--color-canvas-fog)", border: "1px solid var(--color-stone-border)", borderRadius: 8, opacity: emailOn ? 1 : 0.55, pointerEvents: emailOn ? "auto" : "none" }}>
              <Bell size={14} color="var(--color-ash-gray)" />
              <TextInput value={emailAddr} onChange={setEmailAddr} style={{ width: 280, height: 32 }} />
              <GhostBtn>Test notification</GhostBtn>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--color-ash-gray)", whiteSpace: "nowrap" }}>Verified · last tested 4d ago</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ash-gray)", marginBottom: 8 }}>Alert types</div>
            {alertRows.map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: "1px solid var(--color-stone-border)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-ash-gray)" }}>{row.hint}</div>
                </div>
                <Toggle on={row.on} onChange={row.set} />
              </div>
            ))}
          </div>
        </FieldGroup>
      </SettingsCard>
    </div>
  );
}

// ── Sidebar tabs ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "Profile", icon: <User size={15} /> },
  { id: "security", label: "Sessions", icon: <Lock size={15} /> },
  { id: "system", label: "System", icon: <Settings size={15} /> },
  { id: "model", label: "AI & Model", icon: <Cpu size={15} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={15} /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_SUBTITLES: Record<TabId, string> = {
  profile: "Your personal profile and identity within Marco.ai.",
  security: "Active sessions and account details.",
  system: "Workspace-wide configuration for inference and alerts.",
  model: "Tune the prediction model and multi-agent reasoning behaviour.",
  notifications: "Where and when Marco.ai should reach out to you.",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>("profile");

  const content: Record<TabId, ReactNode> = {
    profile: <ProfileTab />,
    security: <SecurityTab />,
    system: <SystemTab />,
    model: <ModelTab />,
    notifications: <NotificationsTab />,
  };

  return (
    <AppShell title="Settings" searchPlaceholder="Search settings...">
      <div style={{ padding: "28px 32px 80px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 32 }}>
        {/* Left sidebar */}
        <aside style={{ position: "sticky", top: 92, alignSelf: "start", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ padding: "0 12px 6px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ash-gray)" }}>
            Settings
          </div>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 12px", borderRadius: 7, border: 0,
                  background: active ? "var(--color-sky-tint)" : "transparent",
                  color: active ? "var(--color-chartwell-blue)" : "var(--color-ash-gray)",
                  fontSize: 13.5, fontWeight: active ? 500 : 400,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  boxShadow: active ? "inset 3px 0 0 var(--color-chartwell-blue)" : "none",
                  transition: "background 0.1s",
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--color-slate-text)", margin: "0 0 4px" }}>
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-ash-gray)", margin: 0 }}>
              {TAB_SUBTITLES[tab]}
            </p>
          </div>
          {content[tab]}
        </div>
      </div>
    </AppShell>
  );
}
