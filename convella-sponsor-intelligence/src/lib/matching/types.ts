/** A single scored dimension of the match, with the evidence that produced it. */
export interface ScoreComponent {
  key: string;
  label: string;
  /** Points awarded. */
  points: number;
  /** Maximum points available for this dimension (from the configured weights). */
  maxPoints: number;
  /** Plain-English justification citing the actual numbers used. */
  reason: string;
  /** True when the underlying data was unavailable — scored neutrally, not as zero-fit. */
  unknown: boolean;
}

export type SignalKind = "positive" | "negative" | "unknown";

/**
 * Signals are stored separately by kind so "we found a problem" is never conflated
 * with "we don't know" — the distinction a human researcher makes instinctively and
 * the previous single-score system could not express.
 */
export interface MatchSignal {
  kind: SignalKind;
  code: string;
  message: string;
  /** How strongly this should influence a human's reading: 1 = minor, 3 = decisive. */
  severity: 1 | 2 | 3;
}

export type Recommendation = "STRONG_MATCH" | "GOOD_MATCH" | "NEEDS_MORE_RESEARCH" | "WEAK_MATCH" | "REJECT";

export interface MatchResult {
  /** 0–100: how suitable this creator is for this brand. */
  matchScore: number;
  /** 0–100: how reliable the evidence behind that score is. */
  confidenceScore: number;
  recommendation: Recommendation;
  components: ScoreComponent[];
  signals: MatchSignal[];
  /** One-paragraph explanation a person can act on. */
  explanation: string;
}

/**
 * Configurable scoring weights (points out of 100). Defaults follow the agreed
 * weighting; every weight is overridable so the model can be tuned as feedback data
 * accumulates without touching the scoring logic.
 */
export interface MatchWeights {
  audienceFit: number;
  contentRelevance: number;
  sponsorshipHistory: number;
  commercialIntent: number;
  viewPerformance: number;
  engagementQuality: number;
  brandCompetitorEvidence: number;
  consistency: number;
  pricingSuitability: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  audienceFit: 25,
  contentRelevance: 20,
  sponsorshipHistory: 15,
  commercialIntent: 10,
  viewPerformance: 10,
  engagementQuality: 5,
  brandCompetitorEvidence: 5,
  consistency: 5,
  pricingSuitability: 5,
};
