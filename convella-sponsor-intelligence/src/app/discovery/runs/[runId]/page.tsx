import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiscoveryRunDetail } from "@/lib/discovery/queries";
import { parseSettingsSnapshot } from "@/lib/discovery/service";
import { PageHeader, Card } from "@/components/ui/card";
import { CandidateStateBadge, DiscoveryRunStatusBadge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatRelativeTime } from "@/lib/format";
import { RunLifecycleControls } from "../../run-controls";

export const dynamic = "force-dynamic";

export default async function DiscoveryRunDetailPage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  const detail = await getDiscoveryRunDetail(runId);
  if (!detail) notFound();

  const { run, audit } = detail;
  const snapshot = parseSettingsSnapshot(run.settingsSnapshot);
  const live = ["QUEUED", "RUNNING"].includes(run.status);

  return (
    <div className="flex flex-col gap-6">
      {live && <AutoRefresh />}

      <PageHeader
        title={`Discovery run — ${run.createdAt.toLocaleString()}`}
        description={`Trigger: ${run.trigger}`}
        actions={<RunLifecycleControls runId={run.id} status={run.status} />}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <DiscoveryRunStatusBadge status={run.status} />
          {run.errorMessage && <span className="text-xs text-amber-700 dark:text-amber-400">{run.errorMessage}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Channels found" value={run.channelsDiscovered} />
          <Stat label="Candidates" value={run.candidatesCreated} />
          <Stat label="Rejected" value={run.candidatesRejected} />
          <Stat label="Qualified" value={run.creatorsQualified} />
          <Stat label="Videos analysed" value={run.videosAnalysed} />
          <Stat label="Quota units" value={run.quotaUnitsUsed} />
          <Stat label="Cost" value={`$${Number(run.totalEstimatedCost).toFixed(2)}`} />
        </dl>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Limits this run executed under (snapshot at start)
          </summary>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Max creators" value={snapshot.maxCreatorsPerRun} />
            <Stat label="Deep-scan videos" value={snapshot.deepScanVideoCount} />
            <Stat label="Subscriber cap" value={snapshot.maxSubscribers.toLocaleString()} />
            <Stat label="Max video age" value={`${snapshot.maxVideoAgeDays}d`} />
            <Stat label="Per-run cost limit" value={`$${snapshot.perRunCostLimitUsd.toFixed(2)}`} />
            <Stat label="Daily cost limit" value={`$${snapshot.dailyCostLimitUsd.toFixed(2)}`} />
            <Stat label="Daily quota budget" value={snapshot.dailyQuotaUnits.toLocaleString()} />
            <Stat label="Rejection cooldown" value={`${snapshot.rejectionCooldownDays}d`} />
          </dl>
        </details>
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="p-5 pb-0 text-sm font-semibold text-foreground">Candidates ({run.candidates.length})</h2>
        {run.candidates.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No candidates yet — the search phase may still be running.</p>
        ) : (
          <table className="mt-3 w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 pb-2 font-medium">Creator</th>
                <th className="px-2 pb-2 font-medium">Subscribers</th>
                <th className="px-2 pb-2 font-medium">Source query</th>
                <th className="px-2 pb-2 font-medium">State</th>
                <th className="px-2 pb-2 font-medium">Reason</th>
                <th className="px-2 pb-2 font-medium">Deep scan</th>
                <th className="px-5 pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {run.candidates.map((candidate) => (
                <tr key={candidate.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    {candidate.channel ? (
                      <Link
                        href={`/channels/${candidate.channel.id}`}
                        className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {candidate.channel.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{candidate.channelTitle ?? candidate.youtubeChannelId}</span>
                    )}
                    {candidate.borderline && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-900/40">
                        borderline
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {candidate.subscriberCountAtDiscovery !== null
                      ? Number(candidate.subscriberCountAtDiscovery).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{candidate.query?.label ?? "—"}</td>
                  <td className="px-2 py-3">
                    <CandidateStateBadge state={candidate.state} />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {candidate.rejectionReason?.replaceAll("_", " ") ?? "—"}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {candidate.deepScanVideoIds.length > 0
                      ? `${candidate.deepScanCursor}/${Math.min(candidate.deepScanVideoIds.length, snapshot.deepScanVideoCount)}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">${Number(candidate.estimatedCost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {audit.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span className="text-foreground">{entry.action.replaceAll(".", " · ").replaceAll("_", " ")}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
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
