import Link from "next/link";
import { DollarSign, Gauge, Radar, Users } from "lucide-react";
import { getDiscoveryDashboardData } from "@/lib/discovery/queries";
import { PageHeader, Card, AnalyticsCard, EmptyState } from "@/components/ui/card";
import { DiscoveryRunStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatRelativeTime } from "@/lib/format";
import { StartRunButton, RunLifecycleControls } from "./run-controls";

export const dynamic = "force-dynamic";

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function DiscoveryDashboardPage() {
  const data = await getDiscoveryDashboardData();
  const { budgets, activeRun, activeRunStates, activeCandidate, recentRuns, enabledQueries } = data;

  const runActive = activeRun !== null && ["QUEUED", "RUNNING", "PAUSED"].includes(activeRun.status);
  const costExhausted = budgets.daySpend >= budgets.dailyCostLimit;
  const quotaExhausted = budgets.quotaUsedToday >= budgets.dailyQuotaUnits;
  const disabledReason = runActive
    ? "A discovery run is already in progress."
    : enabledQueries === 0
      ? "No enabled search queries — configure one first."
      : costExhausted
        ? "Daily cost limit reached — raise it in Settings or wait for the daily reset."
        : quotaExhausted
          ? "Daily YouTube quota budget exhausted — resumes tomorrow."
          : undefined;

  return (
    <div className="flex flex-col gap-8">
      {activeRun && ["QUEUED", "RUNNING"].includes(activeRun.status) && <AutoRefresh />}

      <PageHeader
        title="Discovery"
        description="Automatically search YouTube, qualify creators, and analyse their sponsorships — no manual URL pasting."
        actions={<StartRunButton disabled={Boolean(disabledReason)} disabledReason={disabledReason} />}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AnalyticsCard
          icon={DollarSign}
          label="Spend today"
          value={`${usd(budgets.daySpend)} / ${usd(budgets.dailyCostLimit)}`}
          accent={costExhausted ? "rose" : "emerald"}
        />
        <AnalyticsCard
          icon={Gauge}
          label="Quota units today"
          value={`${budgets.quotaUsedToday.toLocaleString()} / ${budgets.dailyQuotaUnits.toLocaleString()}`}
          accent={quotaExhausted ? "rose" : "sky"}
        />
        <AnalyticsCard icon={Users} label="Creators qualified today" value={budgets.qualifiedToday} accent="violet" />
        <AnalyticsCard icon={Radar} label="Enabled search queries" value={enabledQueries} accent="indigo" />
      </div>

      {activeRun && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Current run</h2>
                <DiscoveryRunStatusBadge status={activeRun.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Started {activeRun.startedAt ? formatRelativeTime(activeRun.startedAt) : "—"} · trigger: {activeRun.trigger}
              </p>
              {activeRun.errorMessage && (
                <p className="mt-2 max-w-xl text-xs text-amber-700 dark:text-amber-400">{activeRun.errorMessage}</p>
              )}
            </div>
            <RunLifecycleControls runId={activeRun.id} status={activeRun.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Channels found" value={activeRun.channelsDiscovered} />
            <Stat label="Candidates" value={activeRun.candidatesCreated} />
            <Stat label="Rejected" value={activeRun.candidatesRejected} />
            <Stat label="Qualified" value={activeRun.creatorsQualified} />
            <Stat label="Videos analysed" value={activeRun.videosAnalysed} />
            <Stat label="Cost so far" value={usd(Number(activeRun.totalEstimatedCost))} />
          </dl>

          {activeCandidate && (
            <p className="mt-4 text-xs text-muted-foreground">
              Currently working on{" "}
              <span className="font-medium text-foreground">{activeCandidate.channelTitle ?? activeCandidate.youtubeChannelId}</span>{" "}
              ({activeCandidate.state.replaceAll("_", " ").toLowerCase()})
            </p>
          )}

          {activeRunStates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeRunStates.map((s) => (
                <span key={s.state} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {s.state.replaceAll("_", " ").toLowerCase()}: {s.count}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Link href={`/discovery/runs/${activeRun.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              View run details →
            </Link>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-sm font-semibold text-foreground">Recent runs</h2>
          <Link href="/discovery/runs" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            View all
          </Link>
        </div>
        {recentRuns.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Radar}
              title="No discovery runs yet"
              description="Configure a search query, then press Run Discovery to find and qualify creators automatically."
              action={<LinkButton href="/discovery/queries">Configure queries</LinkButton>}
            />
          </div>
        ) : (
          <table className="mt-3 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 pb-2 font-medium">Started</th>
                <th className="px-2 pb-2 font-medium">Status</th>
                <th className="px-2 pb-2 font-medium">Found</th>
                <th className="px-2 pb-2 font-medium">Qualified</th>
                <th className="px-2 pb-2 font-medium">Rejected</th>
                <th className="px-2 pb-2 font-medium">Videos</th>
                <th className="px-2 pb-2 font-medium">Quota</th>
                <th className="px-5 pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentRuns.map((run) => (
                <tr key={run.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <Link href={`/discovery/runs/${run.id}`} className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400">
                      {formatRelativeTime(run.createdAt)}
                    </Link>
                  </td>
                  <td className="px-2 py-3">
                    <DiscoveryRunStatusBadge status={run.status} />
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{run.channelsDiscovered}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.creatorsQualified}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.candidatesRejected}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.videosAnalysed}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.quotaUnitsUsed}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{usd(Number(run.totalEstimatedCost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
