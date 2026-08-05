import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";
import { MobileNav } from "./mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 lg:hidden">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="size-4" />
          </span>
          <p className="text-sm font-semibold text-foreground">Convella Sponsor Intelligence</p>
        </header>
        <MobileNav />
        <div className="hidden lg:block">
          <TopHeader />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
