"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { addSourceSchema } from "@/lib/validation/schemas";
import { parseYouTubeInput, YouTubeInputParseError } from "@/lib/youtube/parse";
import { resolveChannelRef } from "@/lib/youtube/resolve";
import { youtubeClient } from "@/lib/youtube/client";
import { YouTubeApiError } from "@/lib/youtube/errors";
import { upsertChannelRecord, scanChannelVideos } from "@/lib/jobs/channel-scan-pipeline";
import { enqueueChannelScanJob, enqueueVideoAnalysisJob } from "@/lib/jobs/queue";

export interface AddSourceState {
  error?: string;
}

export async function addSourceAction(_prevState: AddSourceState | undefined, formData: FormData): Promise<AddSourceState> {
  const parsed = addSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  let parsedInput;
  try {
    parsedInput = parseYouTubeInput(data.input);
  } catch (error) {
    return { error: error instanceof YouTubeInputParseError ? error.message : "Could not parse that input." };
  }

  try {
    if (parsedInput.type === "video") {
      const ytVideo = await youtubeClient.getVideoById(parsedInput.videoId);
      const ytChannel = await youtubeClient.getChannelById(ytVideo.channelId);
      const channel = await upsertChannelRecord(ytChannel, {
        category: data.category || undefined,
        notes: data.notes || undefined,
      });

      const videoRow = await prisma.video.upsert({
        where: { youtubeVideoId: ytVideo.id },
        update: {
          title: ytVideo.title,
          description: ytVideo.description,
          thumbnailUrl: ytVideo.thumbnailUrl,
          publishedAt: ytVideo.publishedAt ? new Date(ytVideo.publishedAt) : null,
          durationSeconds: ytVideo.durationSeconds,
          viewCount: ytVideo.viewCount,
          likeCount: ytVideo.likeCount,
          tags: ytVideo.tags,
          paidProductPlacement: ytVideo.paidProductPlacement,
        },
        create: {
          youtubeVideoId: ytVideo.id,
          channelId: channel.id,
          title: ytVideo.title,
          description: ytVideo.description,
          thumbnailUrl: ytVideo.thumbnailUrl,
          publishedAt: ytVideo.publishedAt ? new Date(ytVideo.publishedAt) : null,
          durationSeconds: ytVideo.durationSeconds,
          viewCount: ytVideo.viewCount,
          likeCount: ytVideo.likeCount,
          tags: ytVideo.tags,
          paidProductPlacement: ytVideo.paidProductPlacement,
          analysisMode: data.analysisMode,
          mediaAuthorised: data.mediaPermissionAcknowledged,
          notes: data.notes || undefined,
        },
      });

      await enqueueVideoAnalysisJob(videoRow.id, data.analysisMode);
      redirect(`/videos/${videoRow.id}`);
    } else {
      const ytChannel = await resolveChannelRef(parsedInput.ref);
      const channel = await upsertChannelRecord(ytChannel, {
        category: data.category || undefined,
        notes: data.notes || undefined,
      });

      const job = await enqueueChannelScanJob(channel.id);
      await scanChannelVideos(job.id, channel.id, data.videoCount, data.analysisMode);
      redirect(`/channels/${channel.id}`);
    }
  } catch (error) {
    if (error instanceof YouTubeApiError) return { error: error.message };
    if (error && typeof error === "object" && "digest" in error) throw error; // Next.js redirect()
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }
}
