"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  LogOut,
  LayoutDashboard,
  Search,
  Settings,
  Server,
  CircleDot,
  Inbox,
  Brain,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearToken, hasToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
  /** @deprecated */
  active?: string;
  /** @deprecated */
  status?: "backend" | "demo";
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/assets", label: "Assets", icon: Server },
  { href: "/bearings", label: "Bearings", icon: CircleDot },
  { href: "/policy", label: "Decision Queue", icon: Inbox, badge: "8" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  title = "Dashboard",
  searchPlaceholder = "Search...",
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasToken()) {
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-canvas-fog)" }}>
      {/* Sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col lg:flex"
        style={{
          background: "var(--color-cloud-white)",
          borderRight: "1px solid var(--color-stone-border)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div
            className="relative flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "var(--color-slate-text)" }}
          >
            <Brain className="h-3.5 w-3.5 text-white" />
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-chartwell-blue)", boxShadow: "0 0 0 2px white" }}
            />
          </div>
          <span
            className="text-[17px] font-medium tracking-tight"
            style={{ color: "var(--color-slate-text)", letterSpacing: "-0.016em" }}
          >
            Marco<span style={{ color: "var(--color-chartwell-blue)" }}>.ai</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                )}
                style={{
                  background: active ? "var(--color-sky-tint)" : "transparent",
                  color: active ? "var(--color-slate-text)" : "var(--color-ash-gray)",
                }}
              >
                {active && (
                  <span
                    className="absolute -left-3 bottom-1.5 top-1.5 w-0.5 rounded-r"
                    style={{ background: "var(--color-chartwell-blue)" }}
                  />
                )}
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: active ? "var(--color-chartwell-blue)" : "currentColor" }}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="rounded-full px-1.5 py-px text-[11px] font-semibold leading-tight text-white"
                    style={{ background: "var(--color-rose)" }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div
          className="mx-3 mb-4 flex items-center gap-2.5 rounded-lg p-3"
          style={{ borderTop: "1px solid var(--color-stone-border)", paddingTop: "16px", marginTop: "8px" }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #3ba6f1, #1c1917)" }}
          >
            OL
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium" style={{ color: "var(--color-slate-text)" }}>
              Operations Lead
            </p>
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: "var(--color-canvas-fog)", color: "var(--color-ash-gray)", border: "1px solid var(--color-stone-border)" }}
            >
              OPERATOR
            </span>
          </div>
          <button
            aria-label="Log out"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas-fog)]"
            onClick={handleLogout}
            style={{ border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
            type="button"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-40 flex h-[60px] items-center justify-between px-8"
          style={{
            background: "var(--color-cloud-white)",
            borderBottom: "1px solid var(--color-stone-border)",
          }}
        >
          <h2
            className="text-[18px] font-medium"
            style={{ color: "var(--color-slate-text)", letterSpacing: "-0.016em" }}
          >
            {title}
          </h2>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 md:flex"
              style={{
                border: "1px solid var(--color-platinum-outline)",
                background: "var(--color-cloud-white)",
                width: 240,
              }}
            >
              <Search className="h-3.5 w-3.5" style={{ color: "var(--color-ash-gray)" }} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--color-slate-text)" }}
              />
              <kbd
                className="rounded px-1 text-[11px]"
                style={{
                  background: "var(--color-canvas-fog)",
                  border: "1px solid var(--color-stone-border)",
                  color: "var(--color-ash-gray)",
                }}
              >
                ⌘K
              </kbd>
            </div>

            {/* Bell */}
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-canvas-fog)]"
              style={{ border: "1px solid var(--color-stone-border)", color: "var(--color-ash-gray)" }}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-rose)", border: "1.5px solid white" }}
              />
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
