import { Search, Bell, Circle } from "lucide-react";
import { hasAnthropicCredentials, hasGeminiCredentials, hasYouTubeCredentials } from "@/lib/env";
import { getQueueStatusSummary } from "@/lib/jobs/list-queries";
import { ThemeToggle } from "./theme-toggle";

async function ApiStatusIndicator() {
  const allConfigured = hasYouTubeCredentials() && hasGeminiCredentials() && hasAnthropicCredentials();
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:flex"
      title={allConfigured ? "YouTube, Gemini, and Anthropic are all configured" : "One or more providers are not configured — see Settings"}
    >
      <Circle className={`size-2 ${allConfigured ? "fill-emerald-500 text-emerald-500" : "fill-amber-500 text-amber-500"}`} />
      API {allConfigured ? "healthy" : "check settings"}
    </div>
  );
}

async function QueueStatusIndicator() {
  const { queued, processing } = await getQueueStatusSummary();
  const active = queued + processing;
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:flex"
      title={`${processing} processing, ${queued} queued`}
    >
      <Circle className={`size-2 ${active > 0 ? "fill-indigo-500 text-indigo-500" : "fill-slate-300 text-slate-300 dark:fill-zinc-600 dark:text-zinc-600"}`} />
      {active > 0 ? `${active} in queue` : "Queue idle"}
    </div>
  );
}

export function TopHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search creators, brands, videos..."
          className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-14 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-border-strong focus:bg-card focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <ApiStatusIndicator />
        <QueueStatusIndicator />

        <button
          type="button"
          aria-label="Notifications"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4" />
        </button>

        <ThemeToggle />

        <span className="ml-1 inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
          CT
        </span>
      </div>
    </header>
  );
}
