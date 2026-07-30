import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";
import { PageHeader, StatCard, Card, EmptyState } from "@/components/ui/card";
import { ConfidenceBadge, ReviewStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

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

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="An overview of monitored channels, sponsor detections, and analysis activity."
        actions={<LinkButton href="/channels/new">Add channel or video</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Channels monitored" value={data.channelsMonitored} />
        <StatCard label="Videos analysed" value={data.videosAnalysed} />
        <StatCard label="Sponsorships detected" value={data.sponsorshipsDetected} />
        <StatCard label="Confirmed sponsorships" value={data.confirmedSponsorships} />
        <StatCard label="Brands discovered" value={data.brandsDiscovered} />
        <StatCard label="Awaiting review" value={data.awaitingReview} />
        <StatCard label="Processing now" value={data.videosProcessing} />
        <StatCard label="Failed analyses" value={data.failedAnalyses} />
        <StatCard
          label="Avg. seconds watched before recognition"
          value={formatSeconds(data.averageSecondsWatched)}
          hint="Across videos where a sponsor was confirmed"
        />
        <StatCard
          label="Avg. model cost per video"
          value={formatCost(data.averageModelCost)}
          hint="Estimated — not a billing-accurate figure"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Recent sponsor detections</h2>
          {data.recentDetections.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No detections yet. Add a channel to get started.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-slate-100">
              {data.recentDetections.map((detection) => (
                <li key={detection.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/videos/${detection.video.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {detection.video.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {detection.brand?.displayName ?? detection.rawBrandName} · {detection.video.channel.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ConfidenceBadge score={detection.confidenceScore} />
                    <ReviewStatusBadge status={detection.reviewStatus} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Most frequently detected brands</h2>
          {data.topBrands.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No brands discovered yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-slate-100">
              {data.topBrands.map(({ brand, count }) => (
                <li key={brand!.id} className="flex items-center justify-between py-3">
                  <Link href={`/brands/${brand!.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                    {brand!.displayName}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {count} placement{count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Most active categories (confirmed placements)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Based on confirmed detected placements only — this is not verified brand spend.
          </p>
          {data.topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No confirmed placements yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-slate-100">
              {data.topCategories.map((c) => (
                <li key={c.category} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-900">{c.category}</span>
                  <span className="text-xs text-slate-500">{c.count} confirmed</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
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
          title="No channels monitored yet"
          description="Add a YouTube channel or individual video to start detecting sponsors."
          action={<LinkButton href="/channels/new">Add your first channel</LinkButton>}
        />
      )}
    </div>
  );
}
