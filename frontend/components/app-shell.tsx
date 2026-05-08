"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
  /** @deprecated — active is now inferred from pathname */
  active?: string;
  /** @deprecated — only used by legacy callers */
  status?: "backend" | "demo";
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/assets", label: "Assets", icon: Gauge },
  { href: "/bearings", label: "Bearings", icon: Wrench },
  { href: "/policy", label: "Policy Bands", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  title = "Predictive Insights",
  searchPlaceholder = "Search systems...",
}: AppShellProps) {
  const pathname = usePathname();

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("architect-hub-theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    window.localStorage.setItem("architect-hub-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const dark = theme === "dark";

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className={cn("min-h-screen", dark ? "bg-[#0f172a] text-slate-100" : "bg-slate-100 text-slate-900")}>
      <div className="flex min-h-screen">
        {/* Left sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex",
            dark ? "border-slate-800 bg-[#0b1222]" : "border-slate-200 bg-white",
          )}
        >
          <div className="flex flex-col gap-0 p-6">
            {/* Logo */}
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <h1 className={cn("text-xl font-bold", dark ? "text-white" : "text-slate-900")}>Architect Hub</h1>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bearing Monitor</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-r-2 border-blue-400 bg-blue-400/10 text-blue-300"
                        : dark
                          ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom: theme + user */}
          <div className="mt-auto space-y-3 p-6">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors",
                dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? "Light Mode" : "Dark Mode"}
            </button>

            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
                OL
              </div>
              <div className="min-w-0">
                <p className={cn("truncate text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>Operations Lead</p>
                <p className={cn("truncate text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>Site Manager</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className={cn("flex min-w-0 flex-1 flex-col", dark ? "bg-[#0f172a]" : "bg-slate-100")}>
          <header
            className={cn(
              "sticky top-0 z-40 flex items-center justify-between border-b px-6 py-3 backdrop-blur-xl",
              dark ? "border-slate-800 bg-[#0f172a]/80" : "border-slate-200 bg-white/80",
            )}
          >
            <div className="flex items-center gap-6">
              <span className={cn("font-bold", dark ? "text-white" : "text-slate-900")}>{title}</span>
              <div className="relative hidden md:block">
                <Search
                  className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")}
                />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  className={cn(
                    "w-56 rounded-full border-none py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                    dark ? "bg-slate-800 text-white placeholder-slate-500" : "bg-slate-100 text-slate-900 placeholder-slate-400",
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
                aria-label="Help"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </header>

          {children}
        </main>

        {/* Right sidebar — Agent Reasoning */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-l xl:flex",
            dark ? "border-slate-800 bg-[#0b1222]" : "border-slate-200 bg-white",
          )}
        >
          <div className={cn("flex items-center gap-3 border-b p-5", dark ? "border-slate-800" : "border-slate-200")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className={cn("text-sm font-bold", dark ? "text-white" : "text-slate-900")}>Agent Reasoning</h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Session</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className={cn("rounded-2xl rounded-tl-none border p-4", dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
              <p className={cn("text-sm leading-relaxed", dark ? "text-slate-300" : "text-slate-700")}>
                Track bearing health in real time with vibration analysis, failure probability, and remaining useful life
                estimates from the two-stage ML pipeline.
              </p>
            </div>
            <p className={cn("ml-1 text-[9px] font-bold uppercase", dark ? "text-slate-500" : "text-slate-400")}>
              Agent · just now
            </p>
          </div>

          <div className={cn("border-t p-5", dark ? "border-slate-800" : "border-slate-200")}>
            <div className="relative">
              <textarea
                className={cn(
                  "w-full resize-none rounded-2xl border p-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                  dark ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500" : "border-slate-200 bg-white text-slate-900 placeholder-slate-400",
                )}
                placeholder="Ask AI assistant..."
                rows={2}
              />
              <button className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
