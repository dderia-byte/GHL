import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import { ensureTranscriptForAnalysis } from "@/lib/transcript/service";
import { classifySponsorshipWithUsage, classifyWithHeuristicFallback } from "@/lib/anthropic/reasoning-service";
import { findOrCreateBrand } from "@/lib/brand/service";
import type { AnalysisInputsUsed, SponsorEvidenceInput } from "@/lib/video-analysis/types";
import type { AnalysisMode } from "@/generated/prisma/enums";
import { runStageOne } from "./stage-one";
import { runStageTwo } from "./stage-two";
import { runStageThree } from "./stage-three";
import { capWindowsToBudget, extractTranscriptWindows } from "./transcript-windows";
import { hashContent } from "./hashing";
import { estimateReasoningModelCost } from "./cost";
import type { StageThreeResult, StageTwoResult } from "./types";

export interface SponsorAnalysisOptions {
  /** Overrides the video's stored analysis mode for this run only. */
  forceMode?: AnalysisMode;
  /** Bypasses hash-based stage reuse and re-runs the full pipeline even if content hasn't changed. */
  forceFullReanalysis?: boolean;
  /**
   * Per-call cost ceiling for discovery runs. Discovery is a wide, cheap sweep — it
   * wants metadata first, a short transcript window only when that is inconclusive, and
   * no native video at all. Omitted for manual single-video analysis, which keeps the
   * full-fidelity behaviour.
   */
  costProfile?: SponsorAnalysisCostProfile;
}

export interface SponsorAnalysisCostProfile {
  /** Allow Stage 2 (transcript windows + cheap model). */
  transcriptFallbackEnabled: boolean;
  /** Transcript seconds analysed per video; windows are trimmed to fit this budget. */
  maxTranscriptSeconds: number;
  /** Allow the paid text model inside Stage 2. When false, Stage 2 stays deterministic. */
  textModelFallbackEnabled: boolean;
  /** Allow Stage 3 (native video/audio/visual). */
  nativeVideoAnalysisEnabled: boolean;
}

/** Which stage actually did the work — reported per video for the run counters. */
export type AnalysisPathway = "METADATA_ONLY" | "TRANSCRIPT_FALLBACK" | "AI_FALLBACK" | "UNCLEAR" | "CACHED";

const DETECTION_WORTHY_CONFIDENCE = 0.25;

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
 * Three-stage cost-optimised sponsor-analysis pipeline. For every video: run free
 * deterministic Stage 1 first, then (only if needed) cheap targeted Stage 2 transcript
 * analysis, then (only if still needed) expensive native-video Stage 3 — stopping at
 * the earliest stage that produces a sufficiently reliable result, and never running a
 * later stage once an earlier one has resolved the sponsor.
 */
export async function runSponsorAnalysisPipeline(
  jobId: string,
  videoId: string,
  options: SponsorAnalysisOptions = {},
): Promise<AnalysisPathway> {
  const env = getEnv();
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  const analysisMode: AnalysisMode = options.forceMode ?? video.analysisMode;
  const profile = options.costProfile ?? null;

  const descriptionSignals = analyseDescription(video.description);
  const metadataSignals = analyseYouTubeMetadata({
    paidProductPlacement: video.paidProductPlacement,
    tags: video.tags,
    title: video.title,
  });

  const descriptionHash = hashContent(video.description);
  const transcript = await ensureTranscriptForAnalysis(videoId);
  const transcriptHash = hashContent(transcript.fullText || "");

  // Idempotency: reuse a previous run's resolved result outright when nothing that
  // would change the outcome has changed (same pipeline version, same description and
  // transcript content, and it already reached a final resolved/unresolved state) —
  // unless the operator explicitly asked for a full reanalysis.
  // Note: `analysisStatus` is deliberately not part of this check — enqueueing a job
  // (including a plain re-run, not just an explicit "Reanalyse") sets it to QUEUED
  // before the pipeline ever runs, so it can't reliably distinguish "already resolved"
  // from "about to run for the first time". `resolvedAtStage` is the right signal: it's
  // only ever set (and never cleared except by `reanalyseVideo`) once a stage actually
  // resolved the sponsor.
  const canReuse =
    !options.forceFullReanalysis &&
    video.pipelineVersion === env.ANALYSIS_PIPELINE_VERSION &&
    video.descriptionHash === descriptionHash &&
    video.transcriptHash === transcriptHash &&
    video.resolvedAtStage !== null;

  if (canReuse) {
    // resolvedAtStage is only ever set once a stage genuinely confirmed a sponsor, so
    // it's safe to restore the video straight to SPONSOR_FOUND here — enqueueing this
    // job already flipped it to QUEUED, and nothing else will correct that if we skip
    // running the pipeline body below.
    await prisma.video.update({ where: { id: videoId }, data: { analysisStatus: "SPONSOR_FOUND" } });
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        progress: 1,
        estimatedCost: 0,
        modelUsage: { reused: true, resolvedAtStage: video.resolvedAtStage },
      },
    });
    return "CACHED";
  }

  await prisma.video.update({ where: { id: videoId }, data: { analysisStatus: "PROCESSING" } });

  // --- Stage 1: free deterministic description/metadata analysis ---------------
  const stageOne = runStageOne(descriptionSignals, metadataSignals);

  let resolvedAtStage: 1 | 2 | 3 | null = null;
  let finalBrandName: string | null = null;
  let finalBrandDomain: string | null = null;
  let finalConfidence = 0;
  let finalReason = stageOne.reason;
  let finalEvidence: SponsorEvidenceInput[] = [...stageOne.evidence];
  let costLimitReached = false;
  let skippedExpensiveReason: string | null = null;
  let stageTwo: StageTwoResult | null = null;
  let stageThree: StageThreeResult | null = null;

  if (stageOne.shouldStop) {
    resolvedAtStage = 1;
    finalBrandName = stageOne.brandName;
    finalBrandDomain = stageOne.brandDomain;
    finalConfidence = stageOne.confidenceScore;
    finalReason = stageOne.reason;
  } else if (profile && !profile.transcriptFallbackEnabled) {
    // Discovery with the transcript fallback switched off: metadata is the whole
    // budget. Anything metadata could not settle is unclear, and that is fine.
    skippedExpensiveReason = "Transcript fallback is disabled for this run.";
    finalBrandName = stageOne.brandName;
    finalBrandDomain = stageOne.brandDomain;
    finalConfidence = stageOne.confidenceScore;
    finalReason = skippedExpensiveReason;
  } else {
    // --- Stage 2: targeted transcript windows, cheap model only if ambiguous ----
    // Discovery caps the transcript at a fixed seconds budget (default 120s: the
    // opening read plus short windows around detected brand names).
    const allWindows = extractTranscriptWindows(transcript.segments);
    const transcriptWindows = profile ? capWindowsToBudget(allWindows, profile.maxTranscriptSeconds) : allWindows;
    stageTwo = await runStageTwo({
      title: video.title,
      candidateBrands: stageOne.candidateBrands,
      windows: transcriptWindows,
      allowModel: profile ? profile.textModelFallbackEnabled : true,
    });
    finalEvidence = [...finalEvidence, ...stageTwo.evidence];

    if (stageTwo.shouldStop) {
      resolvedAtStage = 2;
      finalBrandName = stageTwo.brandName;
      finalBrandDomain = stageTwo.brandDomain;
      finalConfidence = stageTwo.confidenceScore;
      finalReason = stageTwo.reason;
    } else if (profile && !profile.nativeVideoAnalysisEnabled) {
      skippedExpensiveReason = "Native video analysis is disabled for discovery runs — video marked unclear.";
      finalBrandName = stageTwo.brandName ?? stageOne.brandName;
      finalBrandDomain = stageTwo.brandDomain ?? stageOne.brandDomain;
      finalConfidence = Math.max(stageOne.confidenceScore, stageTwo.confidenceScore);
      finalReason = skippedExpensiveReason;
    } else if (!env.ENABLE_NATIVE_VIDEO_ANALYSIS) {
      skippedExpensiveReason = "Native video analysis is disabled.";
      finalBrandName = stageTwo.brandName ?? stageOne.brandName;
      finalBrandDomain = stageTwo.brandDomain ?? stageOne.brandDomain;
      finalConfidence = Math.max(stageOne.confidenceScore, stageTwo.confidenceScore);
      finalReason = skippedExpensiveReason;
    } else if (video.durationSeconds === null || video.durationSeconds <= 0) {
      skippedExpensiveReason = "Video duration is unknown; cannot run native video analysis.";
      finalReason = skippedExpensiveReason;
    } else {
      // --- Stage 3: expensive targeted native video/audio analysis --------------
      try {
        stageThree = await runStageThree({
          youtubeVideoId: video.youtubeVideoId,
          title: video.title,
          description: video.description,
          durationSeconds: video.durationSeconds,
          descriptionSignals,
          metadataSignals,
          candidateBrands: stageOne.candidateBrands,
          transcriptWindows,
          priorEvidence: finalEvidence,
          analysisMode,
        });
      } catch (error) {
        // A Stage 3 failure degrades to human review with whatever Stage 1/2 already
        // found — it does not fail the whole job (which would force an expensive
        // Stage 2 re-run on retry) and never silently claims video analysis succeeded.
        stageThree = {
          completed: false,
          shouldStop: false,
          nativeVideoUsed: false,
          nativeAudioUsed: false,
          visualAnalysisUsed: false,
          videoSecondsAnalysed: 0,
          callsMade: 0,
          estimatedCost: 0,
          confidenceScore: 0,
          evidence: [],
          costLimitReached: false,
          reason: `Stage 3 failed: ${error instanceof Error ? error.message : String(error)}`,
          brandName: null,
          brandDomain: null,
        };
      }

      finalEvidence = [...finalEvidence, ...stageThree.evidence];
      costLimitReached = stageThree.costLimitReached;

      if (stageThree.shouldStop) {
        resolvedAtStage = 3;
        finalBrandName = stageThree.brandName;
        finalBrandDomain = stageThree.brandDomain;
        finalConfidence = stageThree.confidenceScore;
        finalReason = stageThree.reason;
      } else {
        finalBrandName = stageThree.brandName ?? stageTwo.brandName ?? stageOne.brandName;
        finalBrandDomain = stageThree.brandDomain ?? stageTwo.brandDomain ?? stageOne.brandDomain;
        finalConfidence = Math.max(stageOne.confidenceScore, stageTwo.confidenceScore, stageThree.confidenceScore);
        finalReason = stageThree.reason;
      }
    }
  }

  // --- Persist a detection if any stage found something worth a human's attention ---
  let anyDetectionCreated = false;
  let reasoningInputTokens = 0;
  let reasoningOutputTokens = 0;

  if (finalBrandName && finalConfidence >= DETECTION_WORTHY_CONFIDENCE) {
    const evidenceForBrand = finalEvidence.filter((e) => e.text.toLowerCase().includes(finalBrandName!.toLowerCase()));
    const classificationRequest = {
      videoTitle: video.title,
      description: video.description,
      brandName: finalBrandName,
      brandDomain: finalBrandDomain,
      evidence: evidenceForBrand.length ? evidenceForBrand : finalEvidence,
      descriptionSignals,
    };

    // A Stage 1 resolution is already an explicit, unambiguous, high-confidence
    // disclosure — spending a reasoning-model call to reclassify it would defeat the
    // entire point of stopping at the cheapest possible stage, so classify it
    // deterministically instead (zero Anthropic calls for the Higgsfield-style case).
    let classification;
    if (resolvedAtStage === 1) {
      classification = classifyWithHeuristicFallback(classificationRequest);
    } else {
      const { detection, inputTokens, outputTokens } = await classifySponsorshipWithUsage(classificationRequest);
      classification = detection;
      reasoningInputTokens = inputTokens;
      reasoningOutputTokens = outputTokens;
    }

    const brand = await findOrCreateBrand({
      rawBrandName: classification.rawBrandName,
      canonicalBrandName: classification.canonicalBrandName,
      domain: classification.brandDomain,
      category: classification.brandCategory,
    });

    const timestamps = finalEvidence.map((e) => e.timestampSeconds).filter((t): t is number => t !== null && t !== undefined);
    const primary = [...finalEvidence].sort((a, b) => b.strength - a.strength)[0];

    const existingDetection = await prisma.sponsorshipDetection.findFirst({ where: { videoId, brandId: brand.id } });
    const detectionData = {
      rawBrandName: classification.rawBrandName,
      placementType: classification.placementType,
      startTimestampSeconds: timestamps.length ? Math.min(...timestamps) : null,
      endTimestampSeconds: timestamps.length ? Math.max(...timestamps) : null,
      evidenceText: primary?.text ?? finalReason,
      evidenceSource: primary?.source ?? "DESCRIPTION",
      confidenceScore: finalConfidence,
      reasoningSummary: classification.reasoningSummary,
      promotionalUrl: classification.promotionalUrl,
      discountCode: classification.discountCode,
      callToAction: classification.callToAction,
      sponsorshipConfirmed: resolvedAtStage !== null,
    } as const;

    const detection = existingDetection
      ? await prisma.sponsorshipDetection.update({ where: { id: existingDetection.id }, data: detectionData })
      : await prisma.sponsorshipDetection.create({ data: { videoId, brandId: brand.id, ...detectionData } });

    await syncDetectionEvidence(detection.id, evidenceForBrand.length ? evidenceForBrand : finalEvidence);
    anyDetectionCreated = true;
  }

  // --- Final video status -----------------------------------------------------
  let finalStatus: "SPONSOR_FOUND" | "NO_SPONSOR_FOUND" | "HUMAN_REVIEW_REQUIRED";
  let stopReason: string;
  if (resolvedAtStage !== null) {
    finalStatus = "SPONSOR_FOUND";
    stopReason = `resolved_at_stage_${resolvedAtStage}`;
  } else if (costLimitReached) {
    finalStatus = "HUMAN_REVIEW_REQUIRED";
    stopReason = "cost_limit_reached";
  } else if (anyDetectionCreated) {
    finalStatus = "HUMAN_REVIEW_REQUIRED";
    stopReason = "no_stage_reached_confirmation_threshold";
  } else {
    finalStatus = "NO_SPONSOR_FOUND";
    stopReason = "no_sponsor_detected";
  }

  const analysisInputsSummary: AnalysisInputsUsed = stageThree
    ? {
        mediaSourceMethod: "YOUTUBE_URL",
        videoInputAnalysed: stageThree.nativeVideoUsed,
        nativeAudioAnalysed: stageThree.nativeAudioUsed,
        visualFramesAnalysed: stageThree.visualAnalysisUsed,
        transcriptProvided: transcript.segments.length > 0,
        descriptionProvided: video.description.trim().length > 0,
        model: env.GEMINI_VIDEO_MODEL,
        providerError: null,
      }
    : {
        mediaSourceMethod: "NONE",
        videoInputAnalysed: false,
        nativeAudioAnalysed: false,
        visualFramesAnalysed: false,
        transcriptProvided: transcript.segments.length > 0,
        descriptionProvided: video.description.trim().length > 0,
        model: stageTwo?.modelName ?? "deterministic-only",
        providerError: null,
      };

  await prisma.video.update({
    where: { id: videoId },
    data: {
      analysisStatus: finalStatus,
      stopReason,
      analysedAt: new Date(),
      lastAnalysisInputs: JSON.parse(JSON.stringify(analysisInputsSummary)),
      resolvedAtStage,
      descriptionHash,
      transcriptHash,
      pipelineVersion: env.ANALYSIS_PIPELINE_VERSION,
    },
  });

  // --- Cost/usage tracking ------------------------------------------------------
  const textModelCalls = stageTwo?.modelUsed ? 1 : 0;
  const reasoningModelCalls = anyDetectionCreated && resolvedAtStage !== 1 ? 1 : 0;
  const videoModelCalls = stageThree?.callsMade ?? 0;

  const estimatedTextCost = stageTwo?.estimatedCost ?? 0;
  const estimatedReasoningCost = anyDetectionCreated ? estimateReasoningModelCost(reasoningInputTokens, reasoningOutputTokens) : 0;
  const estimatedVideoCost = stageThree?.estimatedCost ?? 0;
  const totalEstimatedCost = estimatedTextCost + estimatedReasoningCost + estimatedVideoCost;

  await prisma.analysisUsage.create({
    data: {
      videoId,
      analysisJobId: jobId,
      resolvedAtStage,
      textModelCalls,
      reasoningModelCalls,
      videoModelCalls,
      inputTokens: (stageTwo?.inputTokens ?? 0) + reasoningInputTokens,
      outputTokens: (stageTwo?.outputTokens ?? 0) + reasoningOutputTokens,
      transcriptCharactersSent: stageTwo?.transcriptCharactersSent ?? 0,
      nativeVideoSecondsAnalysed: stageThree?.videoSecondsAnalysed ?? 0,
      estimatedTextCost,
      estimatedReasoningCost,
      estimatedVideoCost,
      totalEstimatedCost,
      costLimitReached,
      skippedExpensiveReason,
      nativeVideoUsed: stageThree?.nativeVideoUsed ?? false,
      nativeAudioUsed: stageThree?.nativeAudioUsed ?? false,
      visualAnalysisUsed: stageThree?.visualAnalysisUsed ?? false,
    },
  });

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      estimatedCost: totalEstimatedCost,
      progress: 1,
      modelUsage: {
        resolvedAtStage,
        textModelCalls,
        reasoningModelCalls,
        videoModelCalls,
        provider: "sponsor-analysis-pipeline-v2",
      },
    },
  });

  // Which stage actually did the work, for the run's cost counters.
  if (resolvedAtStage === 1) return "METADATA_ONLY";
  if (resolvedAtStage === 2) return stageTwo?.modelUsed ? "AI_FALLBACK" : "TRANSCRIPT_FALLBACK";
  if (resolvedAtStage === 3) return "AI_FALLBACK";
  if (stageThree?.callsMade || stageTwo?.modelUsed) return "AI_FALLBACK";
  if (stageTwo && stageTwo.transcriptWindowsAnalysed > 0) return "TRANSCRIPT_FALLBACK";
  // No commercial signal anywhere in title/description/metadata is a CONCLUSION, not a
  // failure to reach one: metadata settled it, for free. Only a video that showed a
  // promotional signal we could not pin to a sponsor is genuinely unclear.
  if (!stageOne.explicitCommercialSignal && stageOne.candidateBrands.length === 0) return "METADATA_ONLY";
  return "UNCLEAR";
}
