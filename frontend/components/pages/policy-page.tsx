"use client";

import { useMemo, useState } from "react";

import { AnalyticsShell } from "@/components/analytics-shell";

const policyBands = [
  { band: "Critical", metric: "Failure Probability", range: "80% - 100%", level: "L4", action: "Immediate shutdown review" },
  { band: "High", metric: "Failure Probability", range: "60% - 79%", level: "L3", action: "Dispatch maintenance this shift" },
  { band: "Moderate", metric: "Failure Probability", range: "35% - 59%", level: "L2", action: "Plan intervention in 24h" },
  { band: "Low", metric: "Failure Probability", range: "0% - 34%", level: "L1", action: "Continue monitoring" },
];

const policyRules = [
  { rule: "R-01", condition: "Failure probability >= 80%", band: "Critical", action: "Escalate to supervisor", status: "active" },
  { rule: "R-02", condition: "RUL < 160 hours", band: "High", action: "Prepare work order", status: "active" },
  { rule: "R-03", condition: "Temperature >= 80°C", band: "Moderate", action: "Lubrication inspection", status: "active" },
];

export function PolicyPage() {
  const [profile, setProfile] = useState("Balanced Profile");
  const [severity, setSeverity] = useState("Standard Severity");

  const summary = useMemo(
    () => `${profile} is using ${policyBands.length} active policy bands with ${severity.toLowerCase()} thresholds applied to automated decisions.`,
    [profile, severity],
  );

  return (
    <AnalyticsShell active="policy" searchPlaceholder="Search policy bands..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-8">
        <section className="mb-8 flex items-center justify-between rounded-2xl border border-slate-800 p-6 shadow-sm animate-gradient">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Decision Rules</p>
            <h2 className="font-headline text-[1.75rem] font-bold leading-tight text-white">Policy Band Management</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={profile} onChange={setProfile} options={["Balanced Profile", "Conservative Profile", "Aggressive Profile"]} />
            <Select value={severity} onChange={setSeverity} options={["Standard Severity", "Elevated Severity", "Critical Severity"]} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#1e293b] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-[1.75rem] font-bold text-white">Automated Policy Sync</h3>
              <p className="mt-2 text-sm text-slate-400">{summary}</p>
            </div>
            <div className="flex gap-3">
              <button className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700">
                Reset to Default
              </button>
              <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
                Save Policy Configuration
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Bands" value="4" />
          <MetricCard label="Auto Approval" value="91%" />
          <MetricCard label="Manual Review" value="6" />
          <MetricCard label="Escalations" value="3" accent="text-amber-500" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-[#1e293b] p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Project Binding</h4>
                <p className="text-xs text-slate-400">This policy layer is linked to the maintenance decision project in your workspace.</p>
              </div>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">Balanced linked</span>
            </div>
            <div className="space-y-4">
              <InfoBlock label="Project Name" value="Risk-Aware-Multi-Agent-Decision-System-for-Predictive-Maintenance-in-Industry-4.0" />
              <InfoBlock label="Bound Module" value="Predictive Maintenance Governance Layer" />
              <InfoBlock label="Decision Objective" value="Translate model risk into explainable maintenance actions." />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#1e293b] p-8 shadow-xl">
            <h4 className="mb-6 text-lg font-bold text-white">Governance Notes</h4>
            <div className="space-y-4 text-sm text-slate-400">
              <Note text="Each policy band converts model output into a concrete maintenance response level." />
              <Note text="Profiles tune how cautious the system should be when approving automated actions." />
              <Note text="Severity changes shift thresholds without breaking project linkage." />
            </div>
          </div>
        </section>

        <DataTable
          description="Policy ranges and actions aligned with the current governance profile."
          title="Defined Policy Bands"
          columns={["Band", "Metric", "Range", "Level", "Action"]}
          rows={policyBands.map((item) => [item.band, item.metric, item.range, item.level, item.action])}
        />

        <DataTable
          description="Rules that transform telemetry conditions into a prescribed action."
          title="Active Policy Rules"
          columns={["Rule", "Condition", "Band", "Action", "Status"]}
          rows={policyRules.map((item) => [item.rule, item.condition, item.band, item.action, item.status])}
        />

      </div>
    </AnalyticsShell>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select
      className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-blue-400 outline-none focus:ring-0"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#1e293b] p-6 text-center shadow-xl">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`font-headline text-4xl font-bold text-white ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">{text}</div>;
}

function DataTable({ title, description, columns, rows }: { title: string; description: string; columns: string[]; rows: string[][] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#1e293b] shadow-xl">
      <div className="border-b border-slate-800 px-6 py-5">
        <h4 className="text-lg font-bold text-white">{title}</h4>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800 bg-slate-950/70">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className="border-b border-slate-800 last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`} className="px-6 py-4 text-sm text-slate-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
