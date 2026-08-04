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
import { selectEligibleVideos } from "./video-eligibility";
import {
  MAX_VIDEOS_PER_CREATOR,
  addUniqueSponsor,
  countsAsExternalPaidSponsor,
  evaluateQualification,
} from "./sponsor-qualification";

/**
 * Uploads fetched per creator before eligibility filtering. Over-fetching means a
 * channel that posts Shorts or streams between long-form videos still yields the
 * five eligible videos the rules allow, without a second API round-trip.
 */
const UPLOAD_FETCH_COUNT = 20;

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

      // Sequential per-video analysis with the qualification stopping rules:
      // stop at two unique confirmed sponsors; reject once four videos have produced
      // none; never analyse more than five. Each video goes through the existing
      // three-stage pipeline, which is free when the description already discloses.
      case "ANALYSING_NEWEST":
      case "CHECKING_SIGNALS":
      case "ANALYSING_SECOND": {
        if (state !== "ANALYSING_SECOND") {
          state = await transition(candidateId, state, "ANALYSING_SECOND");
        }

        while (true) {
          const fresh = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
          const cursor = fresh.deepScanCursor;

          const verdict = evaluateQualification({
            uniqueSponsors: fresh.uniqueSponsors,
            videosAnalysed: cursor,
          });
          if (verdict.action === "QUALIFY") {
            state = await transition(candidateId, "ANALYSING_SECOND", "QUALIFIED");
            break;
          }
          if (verdict.action === "REJECT") {
            await rejectCandidate(candidateId, "ANALYSING_SECOND", "REJECTED_NO_SPONSOR", settings, verdict.reason);
            await completeJob(jobId);
            await finalizeRunIfDone(run.id);
            return;
          }

          // Ran out of eligible videos before reaching a stopping condition.
          if (cursor >= fresh.deepScanVideoIds.length) {
            if (fresh.uniqueSponsors.length > 0) {
              state = await transition(candidateId, "ANALYSING_SECOND", "QUALIFIED");
              break;
            }
            await rejectCandidate(
              candidateId,
              "ANALYSING_SECOND",
              "REJECTED_NO_SPONSOR",
              settings,
              `Only ${fresh.deepScanVideoIds.length} eligible long-form video(s) available, none sponsored.`,
            );
            await completeJob(jobId);
            await finalizeRunIfDone(run.id);
            return;
          }

          // Cooperative pause/cancel between videos — never mid-model-call.
          const liveRun = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } });
          if (liveRun.cancelRequested) {
            await transition(candidateId, "ANALYSING_SECOND", "CANCELLED");
            await prisma.analysisJob.update({ where: { id: jobId }, data: { status: "CANCELLED", completedAt: new Date() } });
            await finalizeRunIfDone(run.id);
            return;
          }
          if (liveRun.status === "PAUSED") {
            await requeueJobWithoutAttempt(jobId);
            return;
          }

          const result = await analyseCandidateVideo(jobId, candidateId, cursor, settings);
          if (result.yielded) return;

          // Record any newly-confirmed EXTERNAL PAID sponsors from this video.
          const sponsors = await collectConfirmedSponsors(fresh.deepScanVideoIds[cursor]);
          let uniqueSponsors = fresh.uniqueSponsors;
          for (const brand of sponsors) {
            const next = addUniqueSponsor(uniqueSponsors, brand);
            uniqueSponsors = next.sponsors;
          }

          await prisma.discoveryCandidate.update({
            where: { id: candidateId },
            data: { deepScanCursor: cursor + 1, uniqueSponsors },
          });
          await prisma.discoveryRun.update({
            where: { id: run.id },
            data: { videosAnalysed: { increment: 1 } },
          });
        }
        continue;
      }

      case "QUALIFIED":
      case "QUALIFIED_PARTIAL":
      case "DEEP_SCANNING": {
        // Qualification is decided by the sequential loop above; this step persists
        // the qualified creator so future runs skip them and the CSV can export them.
        const fresh = await prisma.discoveryCandidate.findUniqueOrThrow({ where: { id: candidateId } });
        if (state !== "DEEP_SCANNING") {
          state = await transition(candidateId, state, "DEEP_SCANNING");
        }

        if (fresh.channelId) {
          await persistQualifiedCreator(fresh.channelId, fresh.uniqueSponsors);
          await buildCreatorProfile(fresh.channelId).catch((error) => {
            console.error(`[discovery] profile build failed for channel ${fresh.channelId}`, error);
          });
        }

        await prisma.discoveryRun.update({
          where: { id: run.id },
          data: { creatorsQualified: { increment: 1 }, qualifiedCount: { increment: 1 } },
        });
        await recordAudit({
          actorType: "worker",
          action: "discovery.candidate.qualified",
          entityType: "DiscoveryCandidate",
          entityId: candidateId,
          detail: { sponsors: fresh.uniqueSponsors, videosAnalysed: fresh.deepScanCursor },
        });

        await transition(candidateId, "DEEP_SCANNING", "COMPLETED");
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
 * Reads the confirmed EXTERNAL PAID sponsor brand names from one analysed video.
 * Affiliate-only promotions, organic mentions, gifted products, unclear mentions and
 * the creator's own products are all excluded (see sponsor-qualification.ts).
 */
async function collectConfirmedSponsors(videoDbId: string): Promise<string[]> {
  const detections = await prisma.sponsorshipDetection.findMany({
    where: { videoId: videoDbId },
    include: { brand: { select: { displayName: true } } },
  });

  const confirmed: string[] = [];
  for (const detection of detections) {
    const brandName = detection.brand?.displayName ?? detection.rawBrandName;
    const verdict = countsAsExternalPaidSponsor({
      brandName,
      placementType: detection.placementType,
      reviewStatus: detection.reviewStatus,
      confidenceScore: detection.confidenceScore,
      evidenceText: detection.evidenceText,
      reasoningSummary: detection.reasoningSummary,
      sponsorshipConfirmed: detection.sponsorshipConfirmed,
    });
    if (verdict.counts) confirmed.push(brandName);
  }
  return confirmed;
}

/**
 * Writes the qualified-creator record that makes this channel permanently skippable
 * by future runs and exportable to the CSV. Done in a transaction so a later failure
 * cannot leave a half-written creator that is neither skippable nor exportable.
 */
async function persistQualifiedCreator(channelId: string, sponsors: string[]): Promise<void> {
  const newestEligible = await prisma.video.findFirst({
    where: {
      channelId,
      isLivestream: false,
      durationSeconds: { gte: 180 },
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });

  await prisma.$transaction(async (tx) => {
    const channel = await tx.channel.findUniqueOrThrow({ where: { id: channelId } });
    await tx.channel.update({
      where: { id: channelId },
      data: {
        qualifiedAt: channel.qualifiedAt ?? new Date(),
        confirmedSponsorBrands: sponsors,
        latestEligibleVideoAt: newestEligible?.publishedAt ?? null,
        discoveredAt: channel.discoveredAt ?? new Date(),
      },
    });
  });
}

/** Optimistic state transition/** Optimistic state transition — fails loudly if another writer moved the candidate first. */
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
  detail?: string,
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
    data: {
      candidatesRejected: { increment: 1 },
      ...(to === "REJECTED_NO_SPONSOR" ? { rejectedNoSponsor: { increment: 1 } } : {}),
    },
  });
  await recordAudit({
    actorType: "worker",
    action: "discovery.candidate.rejected",
    entityType: "DiscoveryCandidate",
    entityId: candidateId,
    detail: { reason: to, detail },
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
    uploads = await provider.getRecentUploads(candidate.youtubeChannelId, UPLOAD_FETCH_COUNT);
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
      const videoIds = await youtubeClient.getRecentUploadVideoIds(ytChannel.uploadsPlaylistId, UPLOAD_FETCH_COUNT);
      uploads = await youtubeClient.getVideosByIds(videoIds);
      await commitQuota(reservationKey);
    } catch (error) {
      await releaseQuota(reservationKey);
      throw error;
    }
  }

  // Eligibility filter: no Shorts, no livestream replays, nothing under three
  // minutes, no duplicates. Only eligible videos are stored for analysis.
  const eligibility = selectEligibleVideos(
    uploads.map((v) => ({
      youtubeVideoId: v.id,
      durationSeconds: v.durationSeconds,
      isLivestream: v.isLivestream,
      publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
      source: v,
    })),
  );
  const eligibleUploads = eligibility.eligible.slice(0, MAX_VIDEOS_PER_CREATOR).map((e) => e.source);

  const newestPublishedAt = eligibleUploads[0]?.publishedAt ? new Date(eligibleUploads[0].publishedAt) : null;
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
  for (const video of eligibleUploads) {
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
        isLivestream: video.isLivestream,
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
        isLivestream: video.isLivestream,
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
