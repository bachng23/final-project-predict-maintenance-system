"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, HelpCircle, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AnalyticsShellProps = {
  active: "dashboard" | "bearing" | "bearings" | "analytics" | "assets" | "policy" | "settings";
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
};

const navItems = [
  { href: "/", label: "Dashboard", key: "dashboard", icon: "dashboard" },
  { href: "/bearings", label: "Bearings", key: "bearings", icon: "precision_manufacturing" },
  { href: "/analytics", label: "Analytics", key: "analytics", icon: "analytics" },
  { href: "/assets", label: "Assets", key: "assets", icon: "inventory_2" },
  { href: "/policy", label: "Policy Bands", key: "policy", icon: "shield" },
  { href: "/settings", label: "Settings", key: "settings", icon: "settings" },
] as const;

export function AnalyticsShell({
  active,
  children,
  title = "Predictive Insights",
  searchPlaceholder = "Search systems...",
}: AnalyticsShellProps) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = window.localStorage.getItem("architect-hub-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });

  useEffect(() => {
    window.localStorage.setItem("architect-hub-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "min-h-screen font-body selection:bg-blue-500/20",
        isDark ? "bg-[#0f172a] text-slate-100" : "bg-slate-100 text-slate-900",
      )}
    >
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 left-0 flex h-screen w-64 flex-col border-r",
            isDark ? "border-slate-800 bg-[#0b1222]" : "border-slate-200 bg-slate-50",
          )}
        >
          <div className="p-8">
            <div className="mb-10 flex items-center gap-3">
              <Image
                alt="Architect Hub Logo"
                className={cn("h-10 w-10 rounded-lg object-contain", isDark && "brightness-110")}
                height={40}
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAW2lK-4ONFb5dET7_H2FuwezGunrtHI_aR54SccLJgo0Jr_DvryuhIjIp9rW8lFUuVN6yIwu4mPjksfRuV4O7h58t2Vc70lZVAdDGLCEqgyeCNPNZujjq9y0Qchb0bGv9ljWUpff0nWhlwPIaT51mCqlZDUkwaHHVAr9IoRfb0hQZMnToFxUVpppP5Y28-Lx9mnS5vRDbNeB0xZiIwRI9okCuh_MTKgIQvR3W0-2WXWvQn7qh7ukuh5Y1K-V05pOuPPInxzOn0ne8"
                width={40}
              />
              <div>
                <h1 className={cn("font-manrope text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                  Architect Hub
                </h1>
                <p
                  className={cn(
                    "font-label text-[10px] uppercase tracking-wider",
                    isDark ? "text-slate-500" : "text-slate-500",
                  )}
                >
                  System Monitoring
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = item.key === active || (active === "bearing" && item.key === "bearings");
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors duration-200",
                      isActive
                        ? isDark
                          ? "border-r-2 border-blue-400 bg-blue-400/10 font-semibold text-blue-400"
                          : "border-r-2 border-blue-600 bg-blue-50 font-semibold text-blue-600"
                        : isDark
                          ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 space-y-6">
              <button
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors duration-200",
                  isDark
                    ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                type="button"
              >
                <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
                <span className="text-sm">{isDark ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 shadow-sm",
                  isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
                )}
              >
                <Image
                  alt="User profile picture"
                  className="h-10 w-10 rounded-full object-cover"
                  height={40}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA72Ge5yeRrCsqpQobaoJNuZw2E3N8Gum365xMA34MfyKLRN6YGEyA8W8tueKHyOSJUou2Et6ye70A0Ztx53yskLVv9zHl0Z8qiam633XzSSpmv-QcLq9-kOA2teBgdKt3XwStYnuEnMV-1cxQ9osSOj-hYuKS7i_0TMg-KFvq3ob4ytCfL_TxFVHyi2lP8-Lw8oIKyGDmjq984GP28tyPqwxhdjEUBgEpyIKAlasWZvB91TAUoiPYaQQjDHa_d1PJtYGv4hYNOsDqK"
                  width={40}
                />
                <div className="overflow-hidden">
                  <p className={cn("truncate text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>Operations Lead</p>
                  <p className={cn("truncate text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>Site Manager</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className={cn("flex min-w-0 flex-1 flex-col", isDark ? "bg-[#0f172a]" : "bg-slate-100")}>
          <header
            className={cn(
              "sticky top-0 z-40 flex items-center justify-between border-b px-8 py-4 backdrop-blur-xl",
              isDark ? "border-slate-800 bg-[#0f172a]/70" : "border-slate-200 bg-white/80",
            )}
          >
            <div className="flex items-center gap-8">
              <span className={cn("font-headline text-lg font-extrabold", isDark ? "text-white" : "text-slate-900")}>
                {title}
              </span>
              <div className="relative">
                <Search
                  className={cn(
                    "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                    isDark ? "text-slate-500" : "text-slate-400",
                  )}
                />
                <input
                  className={cn(
                    "w-64 rounded-full border-none py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/50",
                    isDark
                      ? "bg-slate-800 text-white placeholder-slate-500"
                      : "bg-slate-100 text-slate-900 placeholder-slate-400",
                  )}
                  placeholder={searchPlaceholder}
                  type="text"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition-all",
                  isDark ? "text-slate-400 hover:text-blue-400" : "text-slate-500 hover:text-blue-600",
                )}
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition-all",
                  isDark ? "text-slate-400 hover:text-blue-400" : "text-slate-500 hover:text-blue-600",
                )}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </header>
          {children}
        </main>

        <aside
          className={cn(
            "flex h-screen w-80 flex-col overflow-hidden border-l shadow-2xl",
            isDark ? "border-slate-800 bg-[#0b1222]" : "border-slate-200 bg-white",
          )}
        >
          <div className={cn("flex items-center justify-between border-b p-6", isDark ? "border-slate-800" : "border-slate-200")}>
            <div>
              <h3 className={cn("font-manrope text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>Agent Reasoning</h3>
              <p className={cn("font-label text-[10px] uppercase tracking-wider", isDark ? "text-slate-500" : "text-slate-400")}>
                Active Session
              </p>
            </div>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-blue-400",
                isDark ? "border-blue-500/20 bg-blue-500/10" : "border-blue-200 bg-blue-50 text-blue-600",
              )}
            >
              <span className="material-symbols-outlined text-sm">smart_toy</span>
            </div>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="flex flex-col gap-2">
              <div
                className={cn(
                  "rounded-2xl rounded-tl-none border p-4",
                  isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>
                  The current workspace is aligned to the new React-based interface, with live navigation across analytics,
                  assets, policy governance, and settings.
                </p>
              </div>
              <p className={cn("ml-1 text-[9px] font-bold uppercase", isDark ? "text-slate-500" : "text-slate-400")}>Agent · 2m ago</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-2xl rounded-tr-none bg-blue-600 p-4 text-white shadow-lg shadow-blue-500/10">
                <p className="text-sm leading-relaxed">Show the new UI for every page and keep the visual system consistent.</p>
              </div>
              <p className={cn("mr-1 text-[9px] font-bold uppercase", isDark ? "text-slate-500" : "text-slate-400")}>You · 1m ago</p>
            </div>
          </div>
          <div className={cn("border-t p-6", isDark ? "border-slate-800 bg-[#0f172a]" : "border-slate-200 bg-slate-50")}>
            <div className="relative">
              <textarea
                className={cn(
                  "w-full resize-none rounded-2xl border p-4 pr-12 text-sm shadow-sm focus:ring-2 focus:ring-blue-500/50",
                  isDark
                    ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                    : "border-slate-200 bg-white text-slate-900 placeholder-slate-400",
                )}
                placeholder="Ask AI assistant..."
                rows={2}
              />
              <button className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500">
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
              </button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all",
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                Generate Report
              </button>
              <button
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all",
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                Export Data
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
