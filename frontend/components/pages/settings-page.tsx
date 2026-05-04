"use client";

import { useState } from "react";

import { AnalyticsShell } from "@/components/analytics-shell";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [threshold, setThreshold] = useState(85);
  const [reasoningMode, setReasoningMode] = useState("Balanced");

  return (
    <AnalyticsShell active="settings" searchPlaceholder="Search settings..." title="Predictive Insights">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 pb-24 md:p-8">
        <section className="rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,#162033,#0f172a_48%,#1f2937)] p-6 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">Configuration Layer</p>
          <h1 className="mt-2 font-headline text-3xl font-bold text-white">System Settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Manage global parameters, notification thresholds, and model preferences from the same dark interface used by the analytics pages.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          <SummaryCard label="Alert Threshold" value={`${threshold}%`} />
          <SummaryCard label="Reasoning Mode" value={reasoningMode} />
          <SummaryCard label="Model Version" value="GPT-Predict v4.2" />
        </div>

        <div className="space-y-6">
          <Panel title="General Settings">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="System Name">
                <input className={fieldClassName()} defaultValue="Architect_Hub_Main" />
              </Field>
              <Field label="Timezone">
                <select className={fieldClassName()} defaultValue="UTC-08:00">
                  <option>UTC-08:00</option>
                  <option>UTC+00:00</option>
                  <option>UTC+01:00</option>
                </select>
              </Field>
              <Field label="Primary Language">
                <select className={fieldClassName()} defaultValue="English">
                  <option>English</option>
                  <option>Mandarin</option>
                  <option>Spanish</option>
                </select>
              </Field>
              <Field label="Inference Frequency">
                <select className={fieldClassName()} defaultValue="Continuous">
                  <option>Continuous</option>
                  <option>Hourly</option>
                  <option>Daily</option>
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Alert Thresholds">
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Failure Probability Trigger</span>
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                    {threshold}%
                  </span>
                </div>
                <input
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
                  max={100}
                  min={0}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  type="range"
                  value={threshold}
                />
                <p className="text-sm text-slate-400">
                  The system will raise an alert when the predictive model exceeds the configured failure threshold.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div>
                  <p className="text-sm font-bold text-white">Critical Anomalies</p>
                  <p className="mt-1 text-xs text-slate-400">Immediate push alerts for catastrophic events.</p>
                </div>
                <button className="relative h-6 w-12 rounded-full bg-blue-600" type="button">
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="AI and Model Preferences">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Model Version">
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  GPT-Predict v4.2 Stable
                </div>
              </Field>
              <Field label="Decision Confidence Profile">
                <select className={fieldClassName()} defaultValue="Balanced">
                  <option>Balanced</option>
                  <option>Conservative</option>
                  <option>Aggressive</option>
                </select>
              </Field>
              <div className="space-y-3 md:col-span-2">
                <label className="block text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Reasoning Mode</label>
                <div className="grid gap-3 md:grid-cols-3">
                  {["Precise", "Balanced", "Exploratory"].map((mode) => (
                    <button
                      key={mode}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-center text-xs font-bold transition-all",
                        mode === reasoningMode
                          ? "border-blue-500 bg-blue-500/10 text-blue-300"
                          : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-900 hover:text-white",
                      )}
                      onClick={() => setReasoningMode(mode)}
                      type="button"
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex justify-end pt-4">
          <button className="rounded-2xl bg-blue-600 px-10 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-500">
            Save Changes
          </button>
        </div>
      </div>
    </AnalyticsShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-3 font-headline text-3xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
      <h3 className="mb-6 text-center font-manrope text-lg font-bold text-white">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function fieldClassName() {
  return "w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-sm text-slate-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
}
