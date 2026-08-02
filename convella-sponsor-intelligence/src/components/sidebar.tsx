"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Building2,
  ClipboardCheck,
  ListChecks,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Radar,
  Search,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channels/new", label: "Add channel or video", icon: PlusCircle },
  { href: "/discovery", label: "Discovery", icon: Radar },
  { href: "/discovery/queries", label: "Search queries", icon: Search },
  { href: "/discovery/creators", label: "Discovered creators", icon: Users },
  { href: "/brands", label: "Brands", icon: Building2 },
  { href: "/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/jobs", label: "Analysis jobs", icon: ListChecks },
];

/**
 * Longest-matching-prefix active detection: /discovery/queries must light up
 * "Search queries" alone, not also the shorter "/discovery" item.
 */
export function isNavActive(pathname: string, href: string, allHrefs: string[]): boolean {
  const matches = (candidate: string) =>
    candidate === "/" ? pathname === "/" : pathname === candidate || pathname.startsWith(`${candidate}/`);
  if (!matches(href)) return false;
  const longest = allHrefs.filter(matches).sort((a, b) => b.length - a.length)[0];
  return longest === href;
}

const STORAGE_KEY = "convella-sidebar-collapsed";
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCollapsedStore(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value));
  listeners.forEach((listener) => listener());
}

const ALL_NAV_HREFS = [...NAV_ITEMS.map((i) => i.href), "/settings"];

function isActive(pathname: string, href: string) {
  return isNavActive(pathname, href, ALL_NAV_HREFS);
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    setCollapsedStore(!collapsed);
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-out lg:flex ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      <div className={`flex h-14 items-center gap-2 border-b border-border ${collapsed ? "justify-center px-0" : "px-5"}`}>
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Sparkles className="size-4" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Convella</p>
            <p className="truncate text-[11px] text-muted-foreground">Sponsor Intelligence</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              {active && <span className="absolute left-0 h-4 w-0.5 rounded-full bg-indigo-600" />}
              <Icon className="size-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border p-3">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
            isActive(pathname, "/settings")
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Settings className="size-4 shrink-0" strokeWidth={2} />
          {!collapsed && <span>Settings</span>}
        </Link>

        <div className={`mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
            CT
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">Convella Team</p>
              <p className="truncate text-[11px] text-muted-foreground">Workspace</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground ${collapsed ? "justify-center px-0" : ""}`}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
