import type { ReactNode } from "react";
import { NavLink } from "./nav-link";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/channels/new", label: "Add channel or video" },
  { href: "/brands", label: "Brands" },
  { href: "/review", label: "Review queue" },
  { href: "/jobs", label: "Analysis jobs" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:flex lg:flex-col">
        <div className="px-2">
          <p className="text-base font-semibold text-slate-900">Convella</p>
          <p className="text-xs text-slate-500">Sponsor Intelligence</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <p className="text-base font-semibold text-slate-900">Convella Sponsor Intelligence</p>
        </header>
        <nav className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
