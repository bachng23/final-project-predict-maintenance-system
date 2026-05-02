"use client";

import Link from "next/link";
import { Activity, Bell, Gauge, HelpCircle, LayoutDashboard, Settings, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  active: "dashboard" | "bearing";
  children: ReactNode;
  title?: string;
  status?: "backend" | "demo";
};

const navItems = [
  { href: "/", label: "Dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/bearings/BRG-001", label: "Bearing Detail", key: "bearing", icon: Gauge },
  { href: "#", label: "Analytics", key: "analytics", icon: Activity },
  { href: "#", label: "Maintenance", key: "maintenance", icon: Wrench },
  { href: "#", label: "Settings", key: "settings", icon: Settings },
];

export function AppShell({ active, children, title = "Predictive Insights", status = "demo" }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0b1222] lg:flex">
          <div className="p-8">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-headline text-xl font-bold text-white">Architect Hub</h1>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bearing Monitor</p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === active;

                return (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors",
                      isActive
                        ? "border-r-2 border-blue-400 bg-blue-400/10 text-blue-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                    href={item.href}
                    key={item.key}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-8">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Source</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  {status === "backend" ? "Web Backend" : "Demo Fallback"}
                </span>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    status === "backend" ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-[#0f172a]/85 px-5 py-4 backdrop-blur-xl md:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">System Monitoring</p>
              <h2 className="truncate font-headline text-lg font-extrabold text-white">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={status === "backend" ? "success" : "warning"}>
                {status === "backend" ? "Live API" : "Demo Data"}
              </Badge>
              <Button aria-label="Notifications" size="icon" variant="ghost">
                <Bell className="h-4 w-4" />
              </Button>
              <Button aria-label="Help" size="icon" variant="ghost">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </header>
          {children}
        </main>

        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col border-l border-slate-800 bg-[#0b1222] xl:flex">
          <div className="border-b border-slate-800 p-6">
            <h3 className="font-headline text-lg font-bold text-white">Agent Reasoning</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Session</p>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="rounded-2xl rounded-tl-sm border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm leading-relaxed text-slate-300">
                Theo dõi bearing theo thời gian thực. Các cảnh báo ưu tiên rung động RMS, nhiệt độ, xác suất lỗi và
                RUL.
              </p>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-blue-400/40 bg-blue-500/10 p-4">
              <p className="text-sm leading-relaxed text-blue-100">
                Gauge D3 đang phản ánh health score mới nhất; time-series Recharts dùng telemetry trực tiếp từ Web
                Backend khi `NEXT_PUBLIC_API_BASE_URL` được cấu hình.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
