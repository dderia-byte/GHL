import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import { runStageOne } from "@/lib/sponsor-analysis/stage-one";
import { detectPromotionalSignals } from "./signals";

export interface GatingVideoInput {
  /** Index into the candidate's deepScanVideoIds (0 = newest). */
  index: number;
  title: string;
  description: string;
  tags: string[];
  paidProductPlacement: boolean;
}

export interface GatingDecision {
  /**
   * A video whose description alone proves sponsorship (Stage 1 strong disclosure).
   * Set => the creator qualifies immediately for ZERO model calls and zero cost.
   */
  freeQualifyingIndex: number | null;
  freeQualifyingBrand: string | null;
  /**
   * Videos worth paying to analyse, best-first: those carrying promotional/affiliate
   * signals but no outright disclosure. Empty => nothing commercial anywhere in the
   * scanned window, so the creator can be rejected without spending anything.
   */
  paidOrder: number[];
  /** Per-video summary persisted on the candidate for auditability. */
  perVideo: Array<{
    index: number;
    strongDisclosure: boolean;
    signalClasses: string[];
    score: number;
  }>;
}

/**
 * Scores how promising an unsponsored-looking video is for a *paid* second look.
 * Weighted by how strongly each signal class predicts a real sponsorship: an explicit
 * (but sub-threshold) disclosure phrase or the YouTube paid-placement flag beats a
 * bare discount code, which beats a generic call-to-action with a link.
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  "paid-product-placement-flag": 5,
  "disclosure-phrases": 4,
  "affiliate-disclosure": 3,
  "discount-codes": 3,
  "campaign-parameters": 2,
  "brand-mentions": 1,
  "cta-with-links": 1,
};

/**
 * The free gate that decides a creator's fate before any money is spent.
 *
 * Scans EVERY recently-uploaded video (not just the newest one) using the same
 * deterministic Stage-1 analysis the paid pipeline starts with — zero Anthropic
 * calls, zero Gemini calls. Creators sponsor intermittently, so gating on the newest
 * upload alone rejects good creators whose latest video simply happens to be
 * unsponsored; scanning the whole window costs nothing and finds them.
 */
export function runFreeGate(videos: GatingVideoInput[]): GatingDecision {
  const perVideo: GatingDecision["perVideo"] = [];
  let freeQualifyingIndex: number | null = null;
  let freeQualifyingBrand: string | null = null;

  for (const video of videos) {
    const descriptionSignals = analyseDescription(video.description);
    const metadataSignals = analyseYouTubeMetadata({
      paidProductPlacement: video.paidProductPlacement,
      tags: video.tags,
      title: video.title,
    });
    const stageOne = runStageOne(descriptionSignals, metadataSignals);

    const promotional = detectPromotionalSignals({
      description: video.description,
      paidProductPlacement: video.paidProductPlacement,
    });
    const score = promotional.matchedClasses.reduce((sum, cls) => sum + (SIGNAL_WEIGHTS[cls] ?? 0), 0);

    perVideo.push({
      index: video.index,
      strongDisclosure: stageOne.shouldStop,
      signalClasses: promotional.matchedClasses,
      score,
    });

    // Newest-first input order, so the first strong disclosure found is the most
    // recent one — the best evidence to qualify (and pitch) the creator on.
    if (stageOne.shouldStop && freeQualifyingIndex === null) {
      freeQualifyingIndex = video.index;
      freeQualifyingBrand = stageOne.brandName;
    }
  }

  const paidOrder = perVideo
    .filter((v) => !v.strongDisclosure && v.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((v) => v.index);

  return { freeQualifyingIndex, freeQualifyingBrand, paidOrder, perVideo };
}
