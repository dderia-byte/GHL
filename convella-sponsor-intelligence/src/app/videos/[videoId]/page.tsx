import { notFound } from "next/navigation";
import Link from "next/link";
import { getVideoDetails } from "@/lib/videos/queries";
import { PageHeader, Card, StatCard } from "@/components/ui/card";
import { AnalysisStatusBadge } from "@/components/ui/badge";
import { DetectionCard } from "./detection-card";
import { TranscriptPanel } from "./transcript-panel";
import { ManualDetectionForm } from "./manual-detection-form";
import { VideoJobActions } from "./video-job-actions";

export const dynamic = "force-dynamic";

function formatNumber(value: number | bigint | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function VideoAnalysisPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const video = await getVideoDetails(videoId);
  if (!video) notFound();

  const latestJob = video.analysisJobs[0];
  const modelUsage = (latestJob?.modelUsage ?? null) as { provider?: string } | null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={video.title}
        description={
          <>
            <Link href={`/channels/${video.channelId}`} className="hover:text-indigo-600">
              {video.channel.name}
            </Link>
            {" · "}
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600"
            >
              View on YouTube
            </a>
          </>
        }
        actions={<AnalysisStatusBadge status={video.analysisStatus} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Views" value={formatNumber(video.viewCount)} />
        <StatCard label="Likes" value={formatNumber(video.likeCount)} />
        <StatCard label="Duration" value={formatDuration(video.durationSeconds)} />
        <StatCard label="Seconds analysed" value={video.secondsAnalysed} />
        <StatCard label="Chunks processed" value={video.chunksProcessed} />
        <StatCard label="Est. cost" value={latestJob ? `$${latestJob.estimatedCost.toFixed(4)}` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{video.description || "No description."}</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Sponsor detections</h2>
            </div>
            {video.sponsorshipDetections.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {video.analysisStatus === "NO_SPONSOR_FOUND"
                  ? "No sponsor was detected in this video."
                  : "No sponsor detections yet."}
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {video.sponsorshipDetections.map((detection) => (
                  <DetectionCard
                    key={detection.id}
                    videoId={video.id}
                    youtubeVideoId={video.youtubeVideoId}
                    detection={{
                      ...detection,
                      brandDisplayName: detection.brand?.displayName ?? null,
                      brandDomain: detection.brand?.domain ?? null,
                    }}
                  />
                ))}
              </div>
            )}
            <div className="mt-4">
              <ManualDetectionForm videoId={video.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Analysis status</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Transcript</dt>
                <dd className="font-medium text-slate-700">{video.transcriptStatus.replaceAll("_", " ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Analysis mode</dt>
                <dd className="font-medium text-slate-700">{video.analysisMode.replaceAll("_", " ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Stop reason</dt>
                <dd className="text-right font-medium text-slate-700">{video.stopReason?.replaceAll("_", " ") ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Model provider</dt>
                <dd className="font-medium text-slate-700">{modelUsage?.provider ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Job attempts</dt>
                <dd className="font-medium text-slate-700">{latestJob?.attempts ?? 0}</dd>
              </div>
            </dl>
            {latestJob?.errorMessage && (
              <p className="mt-3 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">
                {latestJob.errorMessage}
              </p>
            )}
            <div className="mt-4">
              <VideoJobActions videoId={video.id} canContinue={video.analysisStatus === "SPONSOR_FOUND" && video.analysisMode === "FIRST_SPONSOR_ONLY"} />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Transcript</h2>
            <div className="mt-3">
              <TranscriptPanel videoId={video.id} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
