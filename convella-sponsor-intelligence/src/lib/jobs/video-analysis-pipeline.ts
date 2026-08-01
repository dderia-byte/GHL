import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import { ensureTranscriptForAnalysis } from "@/lib/transcript/service";
import { getVideoAnalysisProvider } from "@/lib/video-analysis";
import type { SponsorEvidenceInput, SponsorRecognitionResult } from "@/lib/video-analysis/types";
import type { DescriptionSignals } from "@/lib/signals/description";
import { evaluateSponsorshipDecision } from "@/lib/decision/engine";
import { classifySponsorship } from "@/lib/anthropic/reasoning-service";
import { findOrCreateBrand } from "@/lib/brand/service";
import { estimateChunkCost, estimateClassificationCost } from "./cost";
import type { AnalysisMode } from "@/generated/prisma/enums";

const SHORT_VIDEO_SECONDS = 600;
const MAX_CHUNKS_PER_VIDEO = 120;
const MAX_ANALYSIS_SECONDS = 3600;

export interface RunVideoAnalysisOptions {
  /** Resume from this offset instead of the beginning (used by "continue analysis" review action). */
  resumeFromSeconds?: number;
  /** Overrides the video's stored analysis mode for this run only. */
  forceMode?: AnalysisMode;
}

/**
 * Deterministic safety net for the very first chunk of a video: if the description
 * itself contains an explicit sponsorship-disclosure phrase (extracted before any AI
 * call, in `analyseDescription`) naming a candidate brand, but the AI video-analysis
 * provider declined to recognise it from chunk audio/visuals alone, surface that
 * description text as `DESCRIPTION`-sourced evidence so the decision engine can still
 * score it. This never fabricates evidence — the text comes straight from the video's
 * real description — and it deliberately does not set a confidence high enough to
 * satisfy the strict auto-stop threshold on its own; it only ensures a reviewable
 * candidate detection is created instead of the video being marked "no sponsor found"
 * purely because the AI provider was overly conservative about chunk-window scoping.
 */
function descriptionOnlyFallback(descriptionSignals: DescriptionSignals): SponsorRecognitionResult | null {
  const brandName = descriptionSignals.candidateBrands[0];
  if (!descriptionSignals.hasExplicitSponsorDisclosure || !brandName) return null;

  const disclosure = descriptionSignals.disclosureMatches[0];
  return {
    recognised: true,
    brandName,
    brandDomain: null,
    placementType: "UNKNOWN",
    sponsorshipConfirmed: false,
    confidenceScore: 0.5,
    startTimestampSeconds: null,
    endTimestampSeconds: null,
    evidence: [
      {
        source: "DESCRIPTION",
        timestampSeconds: null,
        text: disclosure?.context ?? `Description states the video is sponsored by ${brandName}.`,
        strength: 0.75,
        metadata: { origin: "deterministic-description-fallback" },
      },
    ],
    reason: `Deterministic description scan found an explicit sponsorship disclosure naming ${brandName}; the AI video-analysis provider did not independently confirm this from chunk audio/visuals.`,
  };
}

async function syncDetectionEvidence(detectionId: string, evidence: SponsorEvidenceInput[]) {
  await prisma.$transaction([
    prisma.sponsorEvidence.deleteMany({ where: { sponsorshipDetectionId: detectionId } }),
    ...(evidence.length
      ? [
          prisma.sponsorEvidence.createMany({
            data: evidence.map((e) => ({
              sponsorshipDetectionId: detectionId,
              source: e.source,
              timestampSeconds: e.timestampSeconds,
              text: e.text,
              strength: e.strength,
              metadata: e.metadata ? JSON.parse(JSON.stringify(e.metadata)) : undefined,
            })),
          }),
        ]
      : []),
  ]);
}

/**
 * Runs the sequential, evidence-accumulating sponsor-recognition loop for a single
 * video: analyses description + metadata up front, then walks the video chunk by
 * chunk (audio, visuals, transcript, description together) until the decision engine
 * says a sponsor is confidently recognised, or the video/job ends. In FIRST_SPONSOR_ONLY
 * mode, analysis stops immediately once the strict stopping condition is met.
 */
export async function runVideoAnalysis(jobId: string, videoId: string, options: RunVideoAnalysisOptions = {}) {
  const env = getEnv();
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  if (video.durationSeconds === null || video.durationSeconds <= 0) {
    throw new Error("Video duration is unknown; cannot run chunked analysis.");
  }

  const analysisMode: AnalysisMode = options.forceMode ?? video.analysisMode;
  const descriptionSignals = analyseDescription(video.description);
  const metadataSignals = analyseYouTubeMetadata({
    paidProductPlacement: video.paidProductPlacement,
    tags: video.tags,
    title: video.title,
  });

  const transcript = await ensureTranscriptForAnalysis(videoId);
  const provider = getVideoAnalysisProvider();

  const chunkSeconds = video.durationSeconds < SHORT_VIDEO_SECONDS ? 30 : env.DEFAULT_CHUNK_SECONDS;
  const maxSeconds = Math.min(video.durationSeconds, MAX_ANALYSIS_SECONDS);

  let cursor = options.resumeFromSeconds ?? 0;
  const observations: SponsorEvidenceInput[] = [];
  let chunksProcessed = 0;
  let estimatedCost = 0;
  let stopReason: string | null = null;
  let stoppedForFirstSponsor = false;
  let anyConfirmed = false;
  let anyDetectionCreated = false;
  let cancelled = false;

  await prisma.video.update({ where: { id: videoId }, data: { analysisStatus: "PROCESSING" } });

  while (cursor < maxSeconds && chunksProcessed < MAX_CHUNKS_PER_VIDEO) {
    const currentJob = await prisma.analysisJob.findUnique({ where: { id: jobId } });
    if (currentJob?.status === "CANCELLED") {
      cancelled = true;
      stopReason = "cancelled_by_user";
      break;
    }

    const end = Math.min(cursor + chunkSeconds, maxSeconds);
    const transcriptContext = transcript.segments.filter(
      (s) => s.startSeconds !== null && s.startSeconds >= cursor - 15 && s.startSeconds <= end + 15,
    );

    let chunkResult = await provider.analyseChunk(
      { videoId: video.youtubeVideoId, startSeconds: cursor, endSeconds: end, mediaReference: "" },
      {
        title: video.title,
        description: video.description,
        transcriptSegments: transcriptContext,
        previousObservations: observations,
        candidateBrands: descriptionSignals.candidateBrands,
      },
    );

    if (!chunkResult.brandName && chunksProcessed === 0) {
      const fallback = descriptionOnlyFallback(descriptionSignals);
      if (fallback) chunkResult = fallback;
    }

    observations.push(...chunkResult.evidence);
    chunksProcessed += 1;
    estimatedCost += estimateChunkCost(false);

    const evaluation = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: observations,
      descriptionSignals,
      metadataSignals,
    });

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        currentChunkStart: cursor,
        currentChunkEnd: end,
        secondsAnalysed: end,
        chunksProcessed,
        progress: Math.min(1, end / maxSeconds),
        estimatedCost,
        modelUsage: { chunks: chunksProcessed, provider: provider.name },
      },
    });
    await prisma.video.update({
      where: { id: videoId },
      data: { secondsAnalysed: end, chunksProcessed },
    });

    if (evaluation.createDetection && evaluation.brandName) {
      anyDetectionCreated = true;
      const evidenceForBrand = observations.filter((e) => e.text.toLowerCase().includes(evaluation.brandName!.toLowerCase()));

      const classification = await classifySponsorship({
        videoTitle: video.title,
        description: video.description,
        brandName: evaluation.brandName,
        brandDomain: evaluation.brandDomain,
        evidence: evidenceForBrand,
        descriptionSignals,
      });
      estimatedCost += estimateClassificationCost();

      const brand = await findOrCreateBrand({
        rawBrandName: classification.rawBrandName,
        canonicalBrandName: classification.canonicalBrandName,
        domain: classification.brandDomain,
        category: classification.brandCategory,
      });

      const existingDetection = await prisma.sponsorshipDetection.findFirst({ where: { videoId, brandId: brand.id } });
      const detectionData = {
        rawBrandName: classification.rawBrandName,
        placementType: classification.placementType,
        startTimestampSeconds: evaluation.startTimestampSeconds,
        endTimestampSeconds: evaluation.endTimestampSeconds,
        evidenceText: evaluation.primaryEvidenceText,
        evidenceSource: evaluation.primaryEvidenceSource,
        confidenceScore: evaluation.confidenceScore,
        reasoningSummary: classification.reasoningSummary,
        promotionalUrl: classification.promotionalUrl,
        discountCode: classification.discountCode,
        callToAction: classification.callToAction,
        sponsorshipConfirmed: evaluation.sponsorshipConfirmed,
      };

      const detection = existingDetection
        ? await prisma.sponsorshipDetection.update({ where: { id: existingDetection.id }, data: detectionData })
        : await prisma.sponsorshipDetection.create({ data: { videoId, brandId: brand.id, ...detectionData } });

      await syncDetectionEvidence(detection.id, evidenceForBrand);

      if (evaluation.shouldStop) {
        anyConfirmed = true;
        stoppedForFirstSponsor = true;
        stopReason = "first_sponsor_confirmed";
        if (analysisMode === "FIRST_SPONSOR_ONLY") {
          cursor = end;
          break;
        }
      }
    }

    cursor = end;
  }

  let finalStatus: "SPONSOR_FOUND" | "NO_SPONSOR_FOUND" | "PARTIAL";
  if (cancelled) {
    finalStatus = "PARTIAL";
  } else if (stoppedForFirstSponsor && analysisMode === "FIRST_SPONSOR_ONLY") {
    finalStatus = "SPONSOR_FOUND";
  } else if (cursor >= maxSeconds && maxSeconds >= video.durationSeconds) {
    finalStatus = anyConfirmed ? "SPONSOR_FOUND" : anyDetectionCreated ? "PARTIAL" : "NO_SPONSOR_FOUND";
    stopReason = stopReason ?? (anyConfirmed ? "reached_end_of_video" : anyDetectionCreated ? "reached_end_with_unconfirmed_candidate" : "no_sponsor_detected");
  } else {
    finalStatus = "PARTIAL";
    stopReason = stopReason ?? "maximum_analysis_duration_reached";
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { analysisStatus: finalStatus, stopReason, analysedAt: new Date() },
  });

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: cancelled ? "CANCELLED" : "COMPLETED",
      completedAt: new Date(),
      estimatedCost,
      chunksProcessed,
      secondsAnalysed: cursor,
      progress: Math.min(1, cursor / maxSeconds),
    },
  });
}
