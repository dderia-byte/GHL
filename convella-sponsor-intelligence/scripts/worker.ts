/**
 * Simple development background worker. Polls the AnalysisJob table for QUEUED
 * VIDEO_ANALYSIS jobs and runs the analysis pipeline for each one. This is the
 * "simple development worker" referenced in the background-job abstraction — swap
 * this polling loop for a BullMQ/Redis consumer later without changing
 * `runVideoAnalysis` itself.
 *
 * Usage: npm run worker
 * Single-pass mode (process at most one job then exit): WORKER_RUN_ONCE=true npm run worker
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { claimNextQueuedJob, failOrRetryJob } from "../src/lib/jobs/queue";
import { runVideoAnalysis } from "../src/lib/jobs/video-analysis-pipeline";

const POLL_INTERVAL_MS = 3000;
let shuttingDown = false;

async function processOnce(): Promise<boolean> {
  const job = await claimNextQueuedJob();
  if (!job || !job.videoId) return false;

  console.log(`[worker] processing video analysis job ${job.id} for video ${job.videoId}`);
  try {
    const video = await prisma.video.findUnique({ where: { id: job.videoId } });
    await runVideoAnalysis(job.id, job.videoId, {
      resumeFromSeconds: video?.secondsAnalysed ?? 0,
      forceMode: job.analysisMode,
    });
    console.log(`[worker] completed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    await failOrRetryJob(job.id, message);
    await prisma.video
      .update({ where: { id: job.videoId }, data: { analysisStatus: "FAILED", stopReason: message.slice(0, 500) } })
      .catch(() => undefined);
  }
  return true;
}

async function loop() {
  while (!shuttingDown) {
    const processed = await processOnce();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  console.log("[worker] shutting down...");
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

if (process.env.WORKER_RUN_ONCE === "true") {
  processOnce()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0));
} else {
  console.log("[worker] started, polling for queued video analysis jobs...");
  loop();
}
