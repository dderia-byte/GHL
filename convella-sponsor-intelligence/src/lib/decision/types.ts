import type { DescriptionSignals } from "../signals/description";
import type { YouTubeMetadataSignals } from "../signals/metadata";
import type { SponsorEvidenceInput, SponsorRecognitionResult } from "../video-analysis/types";

export interface DecisionEngineInput {
  chunkResult: SponsorRecognitionResult;
  /** All evidence accumulated so far, including the current chunk's evidence. */
  accumulatedEvidence: SponsorEvidenceInput[];
  descriptionSignals: DescriptionSignals;
  metadataSignals: YouTubeMetadataSignals;
}

export interface ScoringBreakdown {
  explicitSpokenStatement: number;
  descriptionDisclosureOrLink: number;
  onScreenSponsorTextOrLogo: number;
  transcriptEvidence: number;
  discountCodeOrCampaignUrl: number;
  youtubeMetadata: number;
  agreementAdjustment: number;
  contradictionPenalty: number;
  ambiguityCap: number | null;
  rawTotal: number;
}

export interface DecisionEvaluation {
  shouldStop: boolean;
  /** True once confidence crosses 0.25 and a detection record is worth persisting for review. */
  createDetection: boolean;
  brandName: string | null;
  brandDomain: string | null;
  confidenceScore: number;
  sponsorshipConfirmed: boolean;
  explicitSignalPresent: boolean;
  brandUnambiguous: boolean;
  startTimestampSeconds: number | null;
  endTimestampSeconds: number | null;
  primaryEvidenceText: string;
  primaryEvidenceSource: SponsorEvidenceInput["source"];
  scoring: ScoringBreakdown;
}
