import type { DescriptionSignals } from "@/lib/signals/description";
import type { YouTubeMetadataSignals } from "@/lib/signals/metadata";
import { getVideoAnalysisProvider } from "@/lib/video-analysis";
import type { SponsorEvidenceInput } from "@/lib/video-analysis/types";
import { evaluateSponsorshipDecision } from "@/lib/decision/engine";
import type { AnalysisMode } from "@/generated/prisma/enums";
import type { CandidateBrand, StageThreeResult } from "./types";
import type { TranscriptWindow } from "./transcript-windows";
import { buildVideoAnalysisWindows } from "./video-windows";
import { checkStage3CostLimits, estimateVideoModelCost } from "./cost";

export interface StageThreeParams {
  youtubeVideoId: string;
  title: string;
  description: string;
  durationSeconds: number;
  descriptionSignals: DescriptionSignals;
  metadataSignals: YouTubeMetadataSignals;
  candidateBrands: CandidateBrand[];
  transcriptWindows: TranscriptWindow[];
  priorEvidence: SponsorEvidenceInput[];
  analysisMode: AnalysisMode;
}

/**
 * Stage 3 of the cost-optimised sponsor-analysis pipeline: only reached when Stage 1
 * and Stage 2 couldn't confidently resolve the sponsor. Analyses a small, targeted set
 * of video windows (never the whole video) via the real Gemini native-video provider,
 * stopping the instant the strict recognition threshold is met — and never exceeding
 * the configured per-video cost/seconds/call-count guardrails.
 */
export async function runStageThree(params: StageThreeParams): Promise<StageThreeResult> {
  const windows = buildVideoAnalysisWindows({
    durationSeconds: params.durationSeconds,
    chapterTimestamps: params.descriptionSignals.chapterTimestamps,
    transcriptWindows: params.transcriptWindows,
    candidateBrandNames: params.candidateBrands.map((c) => c.name),
  });

  if (windows.length === 0) {
    return {
      completed: true,
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
      reason: "No video windows could be constructed (unknown duration).",
      brandName: null,
      brandDomain: null,
    };
  }

  const provider = getVideoAnalysisProvider();
  const observations: SponsorEvidenceInput[] = [...params.priorEvidence];

  let callsMade = 0;
  let videoSecondsAnalysed = 0;
  let estimatedCost = 0;
  let nativeVideoUsed = false;
  let nativeAudioUsed = false;
  let visualAnalysisUsed = false;
  let costLimitReached = false;
  let costLimitReason: string | null = null;

  let bestBrandName: string | null = null;
  let bestBrandDomain: string | null = null;
  let bestConfidence = 0;
  let bestReason = "No sponsor reached the confirmation threshold within the analysed windows.";

  for (const window of windows) {
    const windowSeconds = window.endSeconds - window.startSeconds;
    const limitCheck = checkStage3CostLimits({ callsMade, secondsAnalysed: videoSecondsAnalysed, estimatedCostSoFar: estimatedCost }, windowSeconds);
    if (!limitCheck.allowed) {
      costLimitReached = true;
      costLimitReason = limitCheck.reason;
      break;
    }

    const chunkResult = await provider.analyseChunk(
      {
        videoId: params.youtubeVideoId,
        startSeconds: window.startSeconds,
        endSeconds: window.endSeconds,
        mediaReference: { type: "YOUTUBE_URL", url: `https://www.youtube.com/watch?v=${params.youtubeVideoId}` },
      },
      {
        title: params.title,
        description: params.description,
        transcriptSegments: [],
        previousObservations: observations,
        candidateBrands: params.candidateBrands.map((c) => c.name),
      },
    );

    callsMade += 1;
    videoSecondsAnalysed += windowSeconds;
    estimatedCost += estimateVideoModelCost(windowSeconds);
    if (chunkResult.analysisInputs.videoInputAnalysed) nativeVideoUsed = true;
    if (chunkResult.analysisInputs.nativeAudioAnalysed) nativeAudioUsed = true;
    if (chunkResult.analysisInputs.visualFramesAnalysed) visualAnalysisUsed = true;

    observations.push(...chunkResult.evidence);

    const evaluation = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: observations,
      descriptionSignals: params.descriptionSignals,
      metadataSignals: params.metadataSignals,
    });

    if (evaluation.confidenceScore > bestConfidence) {
      bestConfidence = evaluation.confidenceScore;
      bestBrandName = evaluation.brandName;
      bestBrandDomain = evaluation.brandDomain;
      bestReason = chunkResult.reason;
    }

    if (evaluation.shouldStop) {
      return {
        completed: true,
        shouldStop: true,
        nativeVideoUsed,
        nativeAudioUsed,
        visualAnalysisUsed,
        videoSecondsAnalysed,
        callsMade,
        estimatedCost,
        confidenceScore: evaluation.confidenceScore,
        evidence: observations,
        costLimitReached: false,
        reason: `Sponsor confirmed at window ${window.startSeconds}s-${window.endSeconds}s: ${chunkResult.reason}`,
        brandName: evaluation.brandName,
        brandDomain: evaluation.brandDomain,
      };
      // FIRST_SPONSOR_ONLY and ALL_SPONSORS both stop Stage 3's own window loop on the
      // first confirmation — "continue analysing the rest of the video" for
      // ALL_SPONSORS is handled by the existing "continue analysis" job action, not by
      // Stage 3 itself, so the per-video cost guardrails always apply per run.
    }
  }

  return {
    completed: true,
    shouldStop: false,
    nativeVideoUsed,
    nativeAudioUsed,
    visualAnalysisUsed,
    videoSecondsAnalysed,
    callsMade,
    estimatedCost,
    confidenceScore: bestConfidence,
    evidence: observations,
    costLimitReached,
    reason: costLimitReached ? (costLimitReason ?? "Cost limit reached before a sponsor could be confirmed.") : bestReason,
    brandName: bestBrandName,
    brandDomain: bestBrandDomain,
  };
}
