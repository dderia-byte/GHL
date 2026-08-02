import Link from "next/link";
import {
  Radio,
  Video,
  Megaphone,
  BadgeCheck,
  Tag,
  Eye,
  Activity,
  AlertTriangle,
  Timer,
  DollarSign,
  Inbox,
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard/queries";
import { PageHeader, Card, AnalyticsCard, EmptyState } from "@/components/ui/card";
import { ConfidenceBadge, ReviewStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  return `$${cost.toFixed(4)}`;
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function BrandLogoPlaceholder({ name }: { name: string }) {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-600 dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-300">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="An overview of monitored channels, sponsor detections, and analysis activity."
        actions={<LinkButton href="/channels/new">Add channel or video</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <AnalyticsCard icon={Radio} label="Channels monitored" value={data.channelsMonitored} accent="sky" />
        <AnalyticsCard icon={Video} label="Videos analysed" value={data.videosAnalysed} accent="indigo" />
        <AnalyticsCard icon={Megaphone} label="Sponsors detected" value={data.sponsorshipsDetected} accent="violet" />
        <AnalyticsCard icon={BadgeCheck} label="Confirmed sponsors" value={data.confirmedSponsorships} accent="emerald" />
        <AnalyticsCard icon={Tag} label="Brands discovered" value={data.brandsDiscovered} accent="violet" />
        <AnalyticsCard icon={Eye} label="Awaiting review" value={data.awaitingReview} accent="amber" />
        <AnalyticsCard icon={Activity} label="Processing now" value={data.videosProcessing} accent="sky" />
        <AnalyticsCard icon={AlertTriangle} label="Failed analyses" value={data.failedAnalyses} accent="rose" />
        <AnalyticsCard icon={Timer} label="Avg. time to recognition" value={formatSeconds(data.averageSecondsWatched)} accent="indigo" />
        <AnalyticsCard icon={DollarSign} label="Avg. cost per video" value={formatCost(data.averageModelCost)} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <div className="p-5 pb-0">
            <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
          </div>
          {data.recentDetections.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No detections yet. Add a channel to get started.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {data.recentDetections.map((detection) => (
                <li key={detection.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                  <BrandLogoPlaceholder name={detection.brand?.displayName ?? detection.rawBrandName} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/videos/${detection.video.id}`}
                      className="block truncate text-sm font-medium text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                    >
                      {detection.video.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {detection.video.channel.name} · detected{" "}
                      <span className="font-medium text-foreground/80">{detection.brand?.displayName ?? detection.rawBrandName}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge score={detection.confidenceScore} />
                      <ReviewStatusBadge status={detection.reviewStatus} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(detection.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="p-5 pb-0">
            <h2 className="text-sm font-semibold text-foreground">Most frequently detected brands</h2>
          </div>
          {data.topBrands.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No brands discovered yet.</p>
          ) : (
            <table className="mt-3 w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2 font-medium">Brand</th>
                  <th className="px-2 pb-2 font-medium">Placements</th>
                  <th className="px-2 pb-2 font-medium">Videos</th>
                  <th className="px-2 pb-2 font-medium">Avg. confidence</th>
                  <th className="px-5 pb-2 text-right font-medium">Last detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topBrands.map(({ brand, count, videoCount, avgConfidence, lastDetectedAt }) => (
                  <tr key={brand!.id} className="group cursor-pointer transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/brands/${brand!.id}`} className="flex items-center gap-2.5">
                        <BrandLogoPlaceholder name={brand!.displayName} />
                        <span className="font-medium text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {brand!.displayName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{count}</td>
                    <td className="px-2 py-3 text-muted-foreground">{videoCount}</td>
                    <td className="px-2 py-3">
                      <ConfidenceBadge score={avgConfidence} />
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{formatRelativeTime(lastDetectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Most active categories (confirmed placements)</h2>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Based on confirmed detected placements only — this is not verified brand spend.
          </p>
          {data.topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No confirmed placements yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-border">
              {data.topCategories.map((c) => (
                <li key={c.category} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-foreground">{c.category}</span>
                  <span className="text-xs text-muted-foreground">{c.count} confirmed</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
          <div className="mt-4 flex flex-col gap-2">
            <LinkButton href="/review" variant="secondary">
              Go to review queue
            </LinkButton>
            <LinkButton href="/jobs" variant="secondary">
              View analysis jobs
            </LinkButton>
            <LinkButton href="/brands" variant="secondary">
              Browse brands
            </LinkButton>
            <LinkButton href="/api/export/all" variant="secondary">
              Export all detections (CSV)
            </LinkButton>
          </div>
        </Card>
      </div>

      {data.channelsMonitored === 0 && (
        <EmptyState
          icon={Inbox}
          title="No channels monitored yet"
          description="Add a YouTube channel or individual video to start detecting sponsors."
          action={<LinkButton href="/channels/new">Add your first channel</LinkButton>}
        />
      )}
    </div>
  );
}
