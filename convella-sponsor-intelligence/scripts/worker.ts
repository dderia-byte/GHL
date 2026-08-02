/**
 * Simple development background worker. Polls the AnalysisJob table for QUEUED jobs
 * (manual VIDEO_ANALYSIS first, then discovery jobs) and dispatches each to its
 * handler. Swap this polling loop for a BullMQ/Redis consumer later without changing
 * any handler — only the claim in src/lib/jobs/queue.ts.
 *
 * Usage: npm run worker
 * Single-pass mode (process at most one job then exit): WORKER_RUN_ONCE=true npm run worker
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { claimNextQueuedJob, failOrRetryJob } from "../src/lib/jobs/queue";
import { runVideoAnalysis } from "../src/lib/jobs/video-analysis-pipeline";
import { processDiscoveryRunJob } from "../src/lib/discovery/run-pipeline";
import { processCreatorQualificationJob } from "../src/lib/discovery/qualification-pipeline";

const POLL_INTERVAL_MS = 3000;
let shuttingDown = false;

async function processOnce(): Promise<boolean> {
  const job = await claimNextQueuedJob();
  if (!job) return false;

  console.log(`[worker] processing ${job.jobType} job ${job.id}`);
  try {
    if (job.jobType === "VIDEO_ANALYSIS" && job.videoId) {
      await runVideoAnalysis(job.id, job.videoId, { forceMode: job.analysisMode });
    } else if (job.jobType === "DISCOVERY_RUN" && job.discoveryRunId) {
      await processDiscoveryRunJob(job.id, job.discoveryRunId);
    } else if (job.jobType === "CREATOR_QUALIFICATION" && job.discoveryCandidateId) {
      await processCreatorQualificationJob(job.id, job.discoveryCandidateId);
    } else {
      throw new Error(`Job ${job.id} has type ${job.jobType} but is missing its target id.`);
    }
    console.log(`[worker] finished job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    const finalJob = await failOrRetryJob(job.id, message);

    // Attempts exhausted: surface the failure on the job's owning entity so it is
    // visible in the UI rather than silently stuck.
    if (finalJob.status === "FAILED") {
      if (job.jobType === "VIDEO_ANALYSIS" && job.videoId) {
        await prisma.video
          .update({ where: { id: job.videoId }, data: { analysisStatus: "FAILED", stopReason: message.slice(0, 500) } })
          .catch(() => undefined);
      } else if (job.jobType === "DISCOVERY_RUN" && job.discoveryRunId) {
        await prisma.discoveryRun
          .update({ where: { id: job.discoveryRunId }, data: { status: "FAILED", errorMessage: message.slice(0, 500) } })
          .catch(() => undefined);
      } else if (job.jobType === "CREATOR_QUALIFICATION" && job.discoveryCandidateId) {
        await prisma.discoveryCandidate
          .update({ where: { id: job.discoveryCandidateId }, data: { state: "ERRORED", errorMessage: message.slice(0, 500) } })
          .catch(() => undefined);
      }
    }
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
  console.log("[worker] started, polling for queued jobs...");
  loop();
}
