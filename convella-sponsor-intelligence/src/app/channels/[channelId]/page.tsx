import { notFound } from "next/navigation";
import Link from "next/link";
import { getChannelDetails } from "@/lib/channels/queries";
import { PageHeader, Card, StatCard } from "@/components/ui/card";
import { AnalysisStatusBadge } from "@/components/ui/badge";
import { ChannelActions } from "./channel-actions";
import { NotesForm } from "./notes-form";

export const dynamic = "force-dynamic";

function formatViews(count: number | bigint | null): string {
  if (count === null) return "—";
  return Number(count).toLocaleString();
}

export default async function ChannelDetailsPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const details = await getChannelDetails(channelId);
  if (!details) notFound();

  const { channel, videosAnalysed, sponsorsDetected, confirmedSponsorships, averageRecentViews } = details;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={channel.name}
        description={channel.handle ?? channel.youtubeChannelId}
        actions={
          <Link
            href={`/api/export/channel/${channel.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Export CSV
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Subscribers" value={channel.subscriberCount !== null ? formatViews(channel.subscriberCount) : "Hidden"} />
        <StatCard label="Total videos" value={channel.totalVideoCount ?? "—"} />
        <StatCard label="Videos analysed" value={videosAnalysed} />
        <StatCard label="Sponsors detected" value={sponsorsDetected} />
        <StatCard label="Confirmed" value={confirmedSponsorships} />
        <StatCard label="Avg. recent views" value={formatViews(averageRecentViews)} />
        <StatCard
          label="Last scanned"
          value={channel.lastScannedAt ? new Date(channel.lastScannedAt).toLocaleDateString() : "Never"}
        />
      </div>

      <Card>
        <p className="text-sm text-slate-600">{channel.description || "No channel description available."}</p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Recent videos</h2>
            {channel.videos.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No videos imported yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-slate-100">
                {channel.videos.map((video) => (
                  <li key={video.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/videos/${video.id}`} className="truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                        {video.title}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : "Unknown date"} ·{" "}
                        {formatViews(video.viewCount)} views · {video.sponsorshipDetections.length} detection(s)
                      </p>
                    </div>
                    <AnalysisStatusBadge status={video.analysisStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Actions</h2>
            <ChannelActions channelId={channel.id} />
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            <NotesForm channelId={channel.id} notes={channel.notes ?? ""} />
          </Card>
        </div>
      </div>
    </div>
  );
}
