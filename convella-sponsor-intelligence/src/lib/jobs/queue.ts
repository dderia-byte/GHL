import { prisma } from "@/lib/db";
import type { AnalysisMode } from "@/generated/prisma/enums";

/**
 * Database-backed job queue. Deliberately minimal — a single `AnalysisJob` table is
 * the queue, with QUEUED/PROCESSING/COMPLETED/FAILED/CANCELLED status transitions.
 * The dev worker (scripts/worker.ts) polls this table. Swapping to Redis/BullMQ later
 * only means replacing `claimNextQueuedJob`'s polling with a consumer callback — the
 * `processVideoAnalysisJob` / `processChannelScanJob` functions it calls stay the same.
 */

export async function enqueueChannelScanJob(channelId: string) {
  return prisma.analysisJob.create({
    data: { channelId, jobType: "CHANNEL_SCAN", status: "PROCESSING", startedAt: new Date() },
  });
}

export async function enqueueVideoAnalysisJob(videoId: string, analysisMode: AnalysisMode) {
  const existingActive = await prisma.analysisJob.findFirst({
    where: { videoId, jobType: "VIDEO_ANALYSIS", status: { in: ["QUEUED", "PROCESSING"] } },
  });
  if (existingActive) return existingActive;

  await prisma.video.update({
    where: { id: videoId },
    data: { analysisStatus: "QUEUED", analysisMode, stopReason: null },
  });

  return prisma.analysisJob.create({
    data: { videoId, jobType: "VIDEO_ANALYSIS", status: "QUEUED", analysisMode },
  });
}

/** Claims the oldest queued job for processing. Not safe for multiple concurrent workers without a real queue. */
export async function claimNextQueuedJob() {
  const job = await prisma.analysisJob.findFirst({
    where: { status: "QUEUED", jobType: "VIDEO_ANALYSIS" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return null;

  return prisma.analysisJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: job.startedAt ?? new Date(), attempts: { increment: 1 } },
  });
}

export async function cancelJob(jobId: string) {
  return prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
}

const MAX_ATTEMPTS = 3;

export async function failOrRetryJob(jobId: string, errorMessage: string) {
  const job = await prisma.analysisJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.attempts < MAX_ATTEMPTS) {
    return prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: "QUEUED", errorMessage },
    });
  }
  return prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage, completedAt: new Date() },
  });
}
