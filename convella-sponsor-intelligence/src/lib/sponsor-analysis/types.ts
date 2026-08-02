import type { SponsorEvidenceInput } from "@/lib/video-analysis/types";

export interface CandidateBrand {
  name: string;
  domain: string | null;
}

/** Stage 1: free deterministic description/metadata analysis. Zero Anthropic/Gemini calls. */
export interface StageOneResult {
  completed: boolean;
  shouldStop: boolean;
  candidateBrands: CandidateBrand[];
  confidenceScore: number;
  explicitCommercialSignal: boolean;
  evidence: SponsorEvidenceInput[];
  promotionalUrl: string | null;
  discountCode: string | null;
  callToAction: string | null;
  creatorOwnedProduct: boolean;
  affiliateOnly: boolean;
  reason: string;
  brandName: string | null;
  brandDomain: string | null;
}

/** Stage 2: targeted transcript-window analysis, cheap text model only when needed. */
export interface StageTwoResult {
  completed: boolean;
  shouldStop: boolean;
  modelUsed: boolean;
  modelName: string | null;
  transcriptWindowsAnalysed: number;
  transcriptCharactersSent: number;
  confidenceScore: number;
  evidence: SponsorEvidenceInput[];
  reason: string;
  brandName: string | null;
  brandDomain: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

/** Stage 3: expensive native video/audio analysis via targeted Gemini windows. */
export interface StageThreeResult {
  completed: boolean;
  shouldStop: boolean;
  nativeVideoUsed: boolean;
  nativeAudioUsed: boolean;
  visualAnalysisUsed: boolean;
  videoSecondsAnalysed: number;
  callsMade: number;
  estimatedCost: number;
  confidenceScore: number;
  evidence: SponsorEvidenceInput[];
  costLimitReached: boolean;
  reason: string;
  brandName: string | null;
  brandDomain: string | null;
}

export interface VideoAnalysisWindow {
  startSeconds: number;
  endSeconds: number;
  reason: string;
  candidateBrands: string[];
  priority: number;
}

export interface ModelRouter {
  getTranscriptModel(): string;
  getReasoningModel(): string;
  getVideoModel(): string;
}

/** What was resolved (or not) across the whole staged run, for persistence/reporting. */
export interface StagedPipelineResult {
  resolvedAtStage: 1 | 2 | 3 | null;
  brandName: string | null;
  brandDomain: string | null;
  confidenceScore: number;
  evidence: SponsorEvidenceInput[];
  reason: string;
  costLimitReached: boolean;
  skippedExpensiveReason: string | null;
  stageOne: StageOneResult;
  stageTwo: StageTwoResult | null;
  stageThree: StageThreeResult | null;
}
