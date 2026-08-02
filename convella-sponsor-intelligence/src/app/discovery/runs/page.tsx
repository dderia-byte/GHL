import Link from "next/link";
import { Radar } from "lucide-react";
import { listDiscoveryRuns } from "@/lib/discovery/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { DiscoveryRunStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const ms = (end ?? new Date()).getTime() - start.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function DiscoveryRunsPage() {
  const runs = await listDiscoveryRuns();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Discovery runs" description="Every discovery run, its funnel numbers, and what it cost." />

      {runs.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No runs yet"
          description="Press Run Discovery on the Discovery page to start the first one."
          action={<LinkButton href="/discovery">Go to Discovery</LinkButton>}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Started</th>
                <th className="px-2 py-3 font-medium">Trigger</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium">Found</th>
                <th className="px-2 py-3 font-medium">Candidates</th>
                <th className="px-2 py-3 font-medium">Qualified</th>
                <th className="px-2 py-3 font-medium">Videos</th>
                <th className="px-2 py-3 font-medium">Quota</th>
                <th className="px-2 py-3 font-medium">Cost</th>
                <th className="px-5 py-3 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/discovery/runs/${run.id}`}
                      className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {run.createdAt.toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{run.trigger}</td>
                  <td className="px-2 py-3">
                    <DiscoveryRunStatusBadge status={run.status} />
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{run.channelsDiscovered}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.candidatesCreated}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.creatorsQualified}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.videosAnalysed}</td>
                  <td className="px-2 py-3 text-muted-foreground">{run.quotaUnitsUsed}</td>
                  <td className="px-2 py-3 text-muted-foreground">${Number(run.totalEstimatedCost).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {formatDuration(run.startedAt, run.completedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
