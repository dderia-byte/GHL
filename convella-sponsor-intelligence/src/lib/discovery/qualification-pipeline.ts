import type { AnalysisStatus, CandidateState } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit/log";
import { getYouTubeSearchProvider } from "@/lib/youtube/search-provider";
import { youtubeClient } from "@/lib/youtube/client";
import type { YouTubeVideoResource } from "@/lib/youtube/types";
import { runSponsorAnalysisPipeline } from "@/lib/sponsor-analysis/pipeline";
import { requeueJobWithoutAttempt } from "@/lib/jobs/queue";
import type { DiscoverySettingsSnapshot } from "@/lib/settings";
import { evaluateActivity } from "./filters";
import { buildCreatorProfile } from "@/lib/creator-profile/build";
import { runFreeGate, type GatingDecision, type GatingVideoInput } from "./gating";
import { canSpend, getDaySpendUsd, getWorstCasePerVideoCost, decimalToNumber } from "./budgets";
import { QUOTA_COST, QuotaExhaustedError, commitQuota, releaseQuota, reserveQuota } from "./quota";
import { finalizeRunIfDone, parseSettingsSnapshot } from "./service";

/**
 * CREATOR_QUALIFICATION job handler: drives one candidate through the qualification
 * decision tree (newest video → promotional-signal check → second video → five-video
 * deep scan), persisting every transition so a crash, retry, pause, or budget halt
 * resumes from exactly where it stopped. Analyses run through the existing
 * three-stage pipeline via per-video child AnalysisJob rows, which keeps cost
 * attribution per video and leaves the pipeline itself completely unchanged.
 */
export async function processCreatorQualificationJob(jobId: string, candidateId: string): Promise<void> {
  const candidate = await prisma.discoveryCandidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { run: true },
  });
  const run = candidate.run;

  if (run.cancelRequested || run.status === "CANCELLED") {
    await transition(candidateId, candidate.state, "CANCELLED");
    await prisma.analysisJob.update({ where: { id: jobId }, data: { status: "CANCELLED", completedAt: new Date() } });
    await finalizeRunIfDone(run.id);
    return;
  }
  if (run.status === "PAUSED" || run.status.startsWith("HALTED")) {
    // Shouldn't normally be claimed (claim filter skips these runs), but a pause that
    // landed mid-claim ends up here: hand the job back untouched.
    await requeueJobWithoutAttempt(jobId);
    return;
  }

  const settings = parseSettingsSnapshot(run.settingsSnapshot);
  let state: CandidateState = candidate.state;

  // The loop advances the persisted state machine one transition at a time until the
  // candidate reaches a terminal state or the handler must yield (pause/halt/cancel).
  while (true) {
    switch (state) {
      case "PENDING_ANALYSIS": {
        const imported = await importCandidateVideos(jobId, candidateId, settings);
        if (imported.halted) return;
        if (!imported.ok) {
          state = "FILTERED_OUT";
          continue;
        }
        state = await transition(candidateId, "PENDING_ANALYSIS", "ANALYSING_NEWEST");
        continue;
      }

      // The FREE gate: deterministically scan EVERY recent video's description and
      // metadata (zero model calls, zero cost) before spending anything. Creators
      // sponsor intermittently, so gating on the newest upload alone rejects good
      // creators whose latest video simply happens to be unsponsored.
      case "ANALYSING_NEWEST": {
        const gate = await runFreeGateForCandidate(candidateId);

        if (gate.freeQualifyingIndex !== null) {
          await recordAudit({
            actorType: "worker",
            action: "discovery.candidate.free_gate_qualified",
            entityType: "DiscoveryCandidate",
            entityId: candidateId,
            detail: {
              videoIndex: gate.freeQualifyingIndex,
              brand: gate.freeQualifyingBrand,
              note: "Qualified from description analysis alone — no model calls.",
            },
          });
          state = await transition(candidateId, "ANALYSING_NEWEST", "QUALIFIED");
          continue;
        }

        if (gate.paidOrder.length === 0) {
          // Nothing commercial anywhere in the scanned window — reject without ever
          // paying for an analysis.
          await rejectCandidate(candidateId, "ANALYSING_NEWEST", "REJECTED_NOT_COMMERCIAL", settings);
          await completeJob(jobId);
          await finalizeRunIfDone(run.id);
          return;
        }

        state = await transition(candidateId, "ANALYSING_NEWEST", "CHECKING_SIGNALS");
        continue;
      }

      // Paid gating: analyse the most promising signal-bearing videos (best-first),
      // up to the configured budget, before deciding.
      case "CHECKING_SIGNALS":
      case "ANALYSING_SECOND": {
        const fresh = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
        const gate = readGatingDecision(fresh.promotionalSignals);
        const budget = Math.min(gate.paidOrder.length, settings.maxGatingPaidVideos);

        if (state === "CHECKING_SIGNALS") {
          state = await transition(candidateId, "CHECKING_SIGNALS", "ANALYSING_SECOND");
        }

        let qualified = false;
        for (let attempt = fresh.gatingCursor; attempt < budget; attempt += 1) {
          const videoIndex = gate.paidOrder[attempt];
          const result = await analyseCandidateVideo(jobId, candidateId, videoIndex, settings);
          if (result.yielded) return;

          await prisma.discoveryCandidate.update({
            where: { id: candidateId },
            data: { gatingCursor: attempt + 1 },
          });

          if (result.status === "SPONSOR_FOUND") {
            qualified = true;
            break;
          }
          if (result.status === "HUMAN_REVIEW_REQUIRED") {
            await prisma.discoveryCandidate.update({ where: { id: candidateId }, data: { borderline: true } });
          }
        }

        if (qualified) {
          state = await transition(candidateId, "ANALYSING_SECOND", "QUALIFIED");
          continue;
        }

        await rejectCandidate(candidateId, "ANALYSING_SECOND", "REJECTED_NO_SPONSOR", settings);
        await completeJob(jobId);
        await finalizeRunIfDone(run.id);
        return;
      }

      case "QUALIFIED": {
        await prisma.discoveryRun.update({
          where: { id: run.id },
          data: { creatorsQualified: { increment: 1 } },
        });
        await recordAudit({
          actorType: "worker",
          action: "discovery.candidate.qualified",
          entityType: "DiscoveryCandidate",
          entityId: candidateId,
        });
        state = await transition(candidateId, "QUALIFIED", "DEEP_SCANNING");
        continue;
      }

      case "QUALIFIED_PARTIAL": {
        // Resumed after a cost halt mid-deep-scan: pick the scan back up.
        state = await transition(candidateId, "QUALIFIED_PARTIAL", "DEEP_SCANNING");
        continue;
      }

      case "DEEP_SCANNING": {
        const fresh = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
        let cursor = fresh.deepScanCursor;
        const total = Math.min(fresh.deepScanVideoIds.length, settings.deepScanVideoCount);

        while (cursor < total) {
          // Cooperative pause/cancel between videos — never mid-model-call.
          const liveRun = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } });
          if (liveRun.cancelRequested) {
            await transition(candidateId, "DEEP_SCANNING", "CANCELLED");
            await prisma.analysisJob.update({ where: { id: jobId }, data: { status: "CANCELLED", completedAt: new Date() } });
            await finalizeRunIfDone(run.id);
            return;
          }
          if (liveRun.status === "PAUSED") {
            await requeueJobWithoutAttempt(jobId);
            return;
          }

          const result = await analyseCandidateVideo(jobId, candidateId, cursor, settings, { partialOnHalt: true });
          if (result.yielded) return;
          cursor += 1;
          await prisma.discoveryCandidate.update({ where: { id: candidateId }, data: { deepScanCursor: cursor } });
        }

        // Rebuild the creator's derived intelligence now that all their videos are
        // analysed — profiles must never lag behind the evidence that feeds scoring.
        if (fresh.channelId) {
          await buildCreatorProfile(fresh.channelId).catch((error) => {
            console.error(`[discovery] profile build failed for channel ${fresh.channelId}`, error);
          });
        }

        await transition(candidateId, "DEEP_SCANNING", "COMPLETED");
        await recordAudit({
          actorType: "worker",
          action: "discovery.candidate.completed",
          entityType: "DiscoveryCandidate",
          entityId: candidateId,
          detail: { videosAnalysed: cursor },
        });
        await completeJob(jobId);
        await finalizeRunIfDone(run.id);
        return;
      }

      case "FILTERED_OUT":
      case "COMPLETED":
      case "REJECTED_NOT_COMMERCIAL":
      case "REJECTED_NO_SPONSOR":
      case "CANCELLED":
      case "ERRORED": {
        // Terminal (a replayed job for an already-finished candidate): nothing to do.
        await completeJob(jobId);
        await finalizeRunIfDone(run.id);
        return;
      }

      default: {
        throw new Error(`Unhandled candidate state: ${state}`);
      }
    }
  }
}

/**
 * Runs the free gate across the candidate's imported videos and persists the result
 * (including the per-video signal breakdown) so the paid phase — and any human
 * reviewing the rejection later — can see exactly what was found where.
 */
async function runFreeGateForCandidate(candidateId: string): Promise<GatingDecision> {
  const candidate = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  const videos = await prisma.video.findMany({
    where: { id: { in: candidate.deepScanVideoIds } },
    select: { id: true, title: true, description: true, tags: true, paidProductPlacement: true },
  });
  const byId = new Map(videos.map((v) => [v.id, v]));

  const inputs: GatingVideoInput[] = candidate.deepScanVideoIds
    .map((videoId, index) => {
      const video = byId.get(videoId);
      if (!video) return null;
      return {
        index,
        title: video.title,
        description: video.description,
        tags: video.tags,
        paidProductPlacement: video.paidProductPlacement,
      };
    })
    .filter((v): v is GatingVideoInput => v !== null);

  const decision = runFreeGate(inputs);
  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: { promotionalSignals: JSON.parse(JSON.stringify(decision)) },
  });
  return decision;
}

/** Reads back the persisted gate decision (resume-safe after a crash or halt). */
function readGatingDecision(raw: unknown): GatingDecision {
  const empty: GatingDecision = { freeQualifyingIndex: null, freeQualifyingBrand: null, paidOrder: [], perVideo: [] };
  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as Partial<GatingDecision>;
  return {
    freeQualifyingIndex: parsed.freeQualifyingIndex ?? null,
    freeQualifyingBrand: parsed.freeQualifyingBrand ?? null,
    paidOrder: Array.isArray(parsed.paidOrder) ? parsed.paidOrder : [],
    perVideo: Array.isArray(parsed.perVideo) ? parsed.perVideo : [],
  };
}

/** Optimistic state transition — fails loudly if another writer moved the candidate first. */
async function transition(candidateId: string, from: CandidateState, to: CandidateState): Promise<CandidateState> {
  const result = await prisma.discoveryCandidate.updateMany({
    where: { id: candidateId, state: from },
    data: { state: to },
  });
  if (result.count !== 1) {
    throw new Error(`Stale candidate state: expected ${from} for ${candidateId} (concurrent transition?)`);
  }
  return to;
}

async function completeJob(jobId: string) {
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: new Date(), progress: 1 },
  });
}

async function rejectCandidate(
  candidateId: string,
  from: CandidateState,
  to: "REJECTED_NOT_COMMERCIAL" | "REJECTED_NO_SPONSOR",
  settings: DiscoverySettingsSnapshot,
) {
  const candidate = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  await transition(candidateId, from, to);
  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: {
      rejectionReason: to === "REJECTED_NOT_COMMERCIAL" ? "NOT_COMMERCIAL" : "NO_SPONSOR",
      rejectionExpiresAt: new Date(Date.now() + settings.rejectionCooldownDays * 24 * 3600 * 1000),
    },
  });
  await prisma.discoveryRun.update({
    where: { id: candidate.discoveryRunId },
    data: { candidatesRejected: { increment: 1 } },
  });
  await recordAudit({
    actorType: "worker",
    action: "discovery.candidate.rejected",
    entityType: "DiscoveryCandidate",
    entityId: candidateId,
    detail: { reason: to },
  });
}

/**
 * PENDING_ANALYSIS step: fetch the candidate's recent uploads (mock fixtures when
 * keyless; uploads playlist + batched hydration otherwise — never search), apply the
 * activity filter, and import Video rows. The chosen video DB ids (newest first) are
 * stored on the candidate as the deep-scan list + resume cursor source of truth.
 */
async function importCandidateVideos(
  jobId: string,
  candidateId: string,
  settings: DiscoverySettingsSnapshot,
): Promise<{ ok: boolean; halted: boolean }> {
  const candidate = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });

  if (candidate.deepScanVideoIds.length > 0) return { ok: true, halted: false }; // resume: already imported

  const provider = getYouTubeSearchProvider();
  let uploads: YouTubeVideoResource[] = [];

  if (provider.getRecentUploads) {
    uploads = await provider.getRecentUploads(candidate.youtubeChannelId, settings.deepScanVideoCount);
  } else {
    const reservationKey = `candidate:${candidateId}:uploads`;
    try {
      await reserveQuota({
        reservationKey,
        units: QUOTA_COST.CHANNELS_LIST + QUOTA_COST.PLAYLIST_ITEMS_PAGE + QUOTA_COST.VIDEOS_LIST,
        purpose: "hydration",
        dailyBudget: settings.dailyQuotaUnits,
        jobId,
      });
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        await haltRunForQuota(jobId, candidate.discoveryRunId, error);
        return { ok: false, halted: true };
      }
      throw error;
    }
    try {
      const ytChannel = await youtubeClient.getChannelById(candidate.youtubeChannelId);
      if (!ytChannel.uploadsPlaylistId) throw new Error("Channel has no uploads playlist.");
      const videoIds = await youtubeClient.getRecentUploadVideoIds(ytChannel.uploadsPlaylistId, settings.deepScanVideoCount);
      uploads = await youtubeClient.getVideosByIds(videoIds);
      await commitQuota(reservationKey);
    } catch (error) {
      await releaseQuota(reservationKey);
      throw error;
    }
  }

  const newestPublishedAt = uploads[0]?.publishedAt ? new Date(uploads[0].publishedAt) : null;
  const activity = evaluateActivity(newestPublishedAt, settings);
  if (!activity.passed) {
    await transition(candidateId, "PENDING_ANALYSIS", "FILTERED_OUT");
    await prisma.discoveryCandidate.update({
      where: { id: candidateId },
      data: {
        rejectionReason: "INACTIVE",
        rejectionExpiresAt: new Date(Date.now() + settings.rejectionCooldownDays * 24 * 3600 * 1000),
      },
    });
    const fresh = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
    await prisma.discoveryRun.update({
      where: { id: fresh.discoveryRunId },
      data: { candidatesRejected: { increment: 1 } },
    });
    await recordAudit({
      actorType: "worker",
      action: "discovery.candidate.rejected",
      entityType: "DiscoveryCandidate",
      entityId: candidateId,
      detail: { reason: "INACTIVE", detail: activity.detail },
    });
    await completeJob(jobId);
    await finalizeRunIfDone(fresh.discoveryRunId);
    return { ok: false, halted: false };
  }

  if (!candidate.channelId) throw new Error("Accepted candidate has no linked Channel row.");

  const videoDbIds: string[] = [];
  for (const video of uploads) {
    const row = await prisma.video.upsert({
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
        channelId: candidate.channelId,
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
    });
    videoDbIds.push(row.id);
  }

  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: { deepScanVideoIds: videoDbIds },
  });
  return { ok: true, halted: false };
}

/**
 * Analyses one of the candidate's videos through the three-stage pipeline via a
 * child VIDEO_ANALYSIS job (kept per-video for cost attribution). Pre-flight budget
 * check runs BEFORE the call at the pipeline's own per-video worst-case cost — a
 * blocked check halts the run resumably; it never fails the job.
 */
async function analyseCandidateVideo(
  jobId: string,
  candidateId: string,
  videoIndex: number,
  settings: DiscoverySettingsSnapshot,
  options: { partialOnHalt?: boolean } = {},
): Promise<{ status: AnalysisStatus | null; yielded: boolean }> {
  const candidate = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  const videoDbId = candidate.deepScanVideoIds[videoIndex];
  if (!videoDbId) return { status: null, yielded: false };

  const existing = await prisma.video.findUniqueOrThrow({ where: { id: videoDbId } });

  const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: candidate.discoveryRunId } });
  const decision = canSpend({
    runSpendSoFar: decimalToNumber(run.totalEstimatedCost),
    perRunLimitUsd: settings.perRunCostLimitUsd,
    daySpendSoFar: await getDaySpendUsd(),
    dailyLimitUsd: settings.dailyCostLimitUsd,
    estimatedNextCost: getWorstCasePerVideoCost(getEnv().MAX_ESTIMATED_COST_PER_VIDEO_USD),
  });
  if (!decision.allowed) {
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "HALTED_COST_LIMIT",
        errorMessage:
          decision.blockedBy === "run"
            ? `Per-run cost limit ($${settings.perRunCostLimitUsd.toFixed(2)}) would be exceeded by the next analysis.`
            : `Daily cost limit ($${settings.dailyCostLimitUsd.toFixed(2)}) would be exceeded by the next analysis.`,
      },
    });
    if (options.partialOnHalt) {
      await transition(candidateId, "DEEP_SCANNING", "QUALIFIED_PARTIAL");
    }
    await requeueJobWithoutAttempt(jobId);
    await recordAudit({
      actorType: "worker",
      action: "discovery.run.halted_cost",
      entityType: "DiscoveryRun",
      entityId: run.id,
      detail: { blockedBy: decision.blockedBy, candidateId },
    });
    return { status: null, yielded: true };
  }

  const childJob = await prisma.analysisJob.create({
    data: {
      videoId: videoDbId,
      jobType: "VIDEO_ANALYSIS",
      status: "PROCESSING",
      startedAt: new Date(),
      analysisMode: "FIRST_SPONSOR_ONLY",
      discoveryRunId: candidate.discoveryRunId,
      discoveryCandidateId: candidateId,
    },
  });
  await prisma.video.update({ where: { id: videoDbId }, data: { analysisStatus: "QUEUED", stopReason: null } });

  try {
    await runSponsorAnalysisPipeline(childJob.id, videoDbId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.analysisJob.update({
      where: { id: childJob.id },
      data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
    });
    await prisma.video.update({
      where: { id: videoDbId },
      data: { analysisStatus: existing.analysisStatus === "NOT_STARTED" ? "FAILED" : existing.analysisStatus },
    });
    throw error; // job-level retry handles it; the state machine resumes at this same video
  }

  const [videoAfter, childAfter] = await Promise.all([
    prisma.video.findUniqueOrThrow({ where: { id: videoDbId } }),
    prisma.analysisJob.findUniqueOrThrow({ where: { id: childJob.id } }),
  ]);

  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: { estimatedCost: { increment: childAfter.estimatedCost } },
  });
  await prisma.discoveryRun.update({
    where: { id: candidate.discoveryRunId },
    data: { totalEstimatedCost: { increment: childAfter.estimatedCost }, videosAnalysed: { increment: 1 } },
  });

  return { status: videoAfter.analysisStatus, yielded: false };
}

async function haltRunForQuota(jobId: string, discoveryRunId: string, error: QuotaExhaustedError) {
  await prisma.discoveryRun.update({
    where: { id: discoveryRunId },
    data: { status: "HALTED_QUOTA_LIMIT", errorMessage: error.message },
  });
  await requeueJobWithoutAttempt(jobId);
  await recordAudit({
    actorType: "worker",
    action: "discovery.run.halted_quota",
    entityType: "DiscoveryRun",
    entityId: discoveryRunId,
    detail: { message: error.message },
  });
}
