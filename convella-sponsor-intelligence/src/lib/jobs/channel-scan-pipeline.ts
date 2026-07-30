import { prisma } from "@/lib/db";
import { youtubeClient } from "@/lib/youtube/client";
import type { YouTubeChannelResource } from "@/lib/youtube/types";
import type { AnalysisMode } from "@/generated/prisma/enums";
import { enqueueVideoAnalysisJob } from "./queue";

/** Upserts a Channel row from already-resolved YouTube channel metadata (no extra API call). */
export async function upsertChannelRecord(channel: YouTubeChannelResource, extra?: { category?: string; notes?: string }) {
  return prisma.channel.upsert({
    where: { youtubeChannelId: channel.id },
    update: {
      handle: channel.handle,
      name: channel.title,
      description: channel.description,
      thumbnailUrl: channel.thumbnailUrl,
      subscriberCount: channel.hiddenSubscriberCount ? null : channel.subscriberCount,
      totalVideoCount: channel.videoCount,
    },
    create: {
      youtubeChannelId: channel.id,
      handle: channel.handle,
      name: channel.title,
      description: channel.description,
      thumbnailUrl: channel.thumbnailUrl,
      subscriberCount: channel.hiddenSubscriberCount ? null : channel.subscriberCount,
      totalVideoCount: channel.videoCount,
      category: extra?.category,
      notes: extra?.notes,
    },
  });
}

export interface ChannelScanSummary {
  videosFetched: number;
  videosQueued: number;
  videosSkippedExisting: number;
}

/**
 * Fetches up to `requestedVideoCount` recent uploads for a channel (via the uploads
 * playlist, not the costlier search.list endpoint), upserts Video rows, and queues a
 * VIDEO_ANALYSIS job for every video that has not already been analysed. A failure on
 * an individual video's analysis job is isolated later by the worker — this scan step
 * itself only fetches metadata, so per-video failures here would only occur for
 * malformed API data, which is skipped rather than aborting the whole scan.
 */
export async function scanChannelVideos(
  jobId: string,
  channelDbId: string,
  requestedVideoCount: number,
  analysisMode: AnalysisMode,
): Promise<ChannelScanSummary> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelDbId } });
  const ytChannel = await youtubeClient.getChannelById(channel.youtubeChannelId);

  if (!ytChannel.uploadsPlaylistId) {
    throw new Error("This channel has no uploads playlist available from the YouTube API.");
  }

  const videoIds = await youtubeClient.getRecentUploadVideoIds(ytChannel.uploadsPlaylistId, requestedVideoCount);
  const videos = await youtubeClient.getVideosByIds(videoIds);

  let videosQueued = 0;
  let videosSkippedExisting = 0;

  for (const video of videos) {
    const videoRow = await prisma.video.upsert({
      where: { youtubeVideoId: video.id },
      update: {
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        tags: video.tags,
        paidProductPlacement: video.paidProductPlacement,
      },
      create: {
        youtubeVideoId: video.id,
        channelId: channel.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        tags: video.tags,
        paidProductPlacement: video.paidProductPlacement,
        analysisMode,
      },
    });

    if (videoRow.analysisStatus === "NOT_STARTED") {
      await enqueueVideoAnalysisJob(videoRow.id, analysisMode);
      videosQueued += 1;
    } else {
      videosSkippedExisting += 1;
    }
  }

  await prisma.channel.update({ where: { id: channel.id }, data: { lastScannedAt: new Date() } });
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: new Date(), progress: 1, chunksProcessed: videos.length },
  });

  return { videosFetched: videos.length, videosQueued, videosSkippedExisting };
}

/** Re-queues every FAILED video for a channel (or all channels if omitted) without touching successful analyses. */
export async function requeueFailedVideos(channelDbId: string, analysisMode: AnalysisMode) {
  const failedVideos = await prisma.video.findMany({ where: { channelId: channelDbId, analysisStatus: "FAILED" } });
  for (const video of failedVideos) {
    await enqueueVideoAnalysisJob(video.id, analysisMode);
  }
  return failedVideos.length;
}
