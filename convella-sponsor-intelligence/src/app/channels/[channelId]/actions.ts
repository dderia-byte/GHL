"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { channelNotesSchema } from "@/lib/validation/schemas";
import { scanChannelVideos, requeueFailedVideos } from "@/lib/jobs/channel-scan-pipeline";
import { enqueueChannelScanJob } from "@/lib/jobs/queue";
import type { AnalysisMode } from "@/generated/prisma/enums";

export async function scanLatestVideosAction(channelId: string, videoCount: number, analysisMode: AnalysisMode) {
  const job = await enqueueChannelScanJob(channelId);
  await scanChannelVideos(job.id, channelId, videoCount, analysisMode);
  revalidatePath(`/channels/${channelId}`);
}

export async function reanalyseFailedVideosAction(channelId: string, analysisMode: AnalysisMode) {
  await requeueFailedVideos(channelId, analysisMode);
  revalidatePath(`/channels/${channelId}`);
}

export async function updateChannelNotesAction(formData: FormData) {
  const parsed = channelNotesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await prisma.channel.update({ where: { id: parsed.data.channelId }, data: { notes: parsed.data.notes } });
  revalidatePath(`/channels/${parsed.data.channelId}`);
}
