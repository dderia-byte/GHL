import type { PlacementType } from "@/generated/prisma/enums";

/**
 * Decides what counts as an EXTERNAL PAID SPONSOR for creator qualification.
 *
 * Deliberately stricter than "a detection exists": qualification is a commercial
 * judgement about whether a brand paid this creator, so anything that is merely
 * commercial-adjacent is excluded. Getting this wrong in the permissive direction
 * fills the CSV with creators who have never actually taken a paid deal.
 */

/** Placements that are not evidence of a paid third-party sponsorship. */
const NON_SPONSOR_PLACEMENTS: PlacementType[] = [
  "AFFILIATE_PROMOTION", // commission-based, not a paid placement
  "ORGANIC_MENTION", // unpaid recommendation
  "FREE_PRODUCT_OR_GIFTED", // gifted product, no fee
  "UNKNOWN", // unclear brand mention — never counted
];

/** Review outcomes that mean a human has ruled the detection out. */
const DISQUALIFYING_REVIEW_STATUSES = ["REJECTED", "ORGANIC"];

/**
 * Wording that indicates the creator is promoting their OWN product/course/SaaS/
 * community rather than a third party's. Checked against the detection's evidence
 * text and reasoning.
 */
const CREATOR_OWNED_PATTERNS = [
  /\bmy (own )?(course|community|saas|app|product|tool|book|newsletter|agency|program|bootcamp)\b/i,
  /\bour (own )?(course|community|saas|app|product|tool|platform)\b/i,
  /\bi (built|created|made|founded|launched)\b/i,
  /\bi'?m the (founder|creator|owner|maker)\b/i,
  /\bjoin my\b/i,
  /\benroll in my\b/i,
  /\bmy new (product|course|app|tool)\b/i,
];

export interface SponsorCandidateDetection {
  brandName: string;
  placementType: PlacementType;
  reviewStatus: string;
  confidenceScore: number;
  /** Detection evidence text plus reasoning — searched for creator-owned wording. */
  evidenceText: string;
  reasoningSummary: string;
  /** Whether the pipeline reached its strict confirmation threshold. */
  sponsorshipConfirmed: boolean;
}

export interface SponsorQualificationResult {
  counts: boolean;
  reason: string;
}

/** Minimum confidence for a detection to count towards qualification. */
export const MIN_SPONSOR_CONFIDENCE = 0.75;

export function looksCreatorOwned(text: string): boolean {
  return CREATOR_OWNED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Whether one detection counts as a confirmed external paid sponsor.
 */
export function countsAsExternalPaidSponsor(detection: SponsorCandidateDetection): SponsorQualificationResult {
  if (DISQUALIFYING_REVIEW_STATUSES.includes(detection.reviewStatus)) {
    return { counts: false, reason: `Human review marked this ${detection.reviewStatus.toLowerCase()}.` };
  }
  if (NON_SPONSOR_PLACEMENTS.includes(detection.placementType)) {
    return { counts: false, reason: `Placement type ${detection.placementType.replaceAll("_", " ").toLowerCase()} is not a paid sponsorship.` };
  }
  if (!detection.sponsorshipConfirmed && detection.confidenceScore < MIN_SPONSOR_CONFIDENCE) {
    return {
      counts: false,
      reason: `Confidence ${(detection.confidenceScore * 100).toFixed(0)}% is below the ${MIN_SPONSOR_CONFIDENCE * 100}% bar and the strict condition was not met.`,
    };
  }
  const combined = `${detection.evidenceText}\n${detection.reasoningSummary}`;
  if (looksCreatorOwned(combined)) {
    return { counts: false, reason: "Reads as the creator's own product, not a third-party paid sponsorship." };
  }
  return { counts: true, reason: "Confirmed external paid sponsorship." };
}

/** Normalises a brand name for uniqueness comparison (case/punctuation-insensitive). */
export function normaliseSponsorKey(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

export interface QualificationProgress {
  /** Unique confirmed sponsor brand names, in discovery order (max 2 retained). */
  uniqueSponsors: string[];
  videosAnalysed: number;
}

export type QualificationVerdict =
  | { action: "CONTINUE" }
  | { action: "QUALIFY"; reason: string }
  | { action: "REJECT"; reason: string };

export const MAX_VIDEOS_PER_CREATOR = 5;
export const MAX_SPONSORS_BEFORE_STOP = 2;
/** With no sponsor by this many videos, the creator is rejected without spending more. */
export const NO_SPONSOR_GIVE_UP_AFTER = 4;

/**
 * The per-creator stopping rule, evaluated after each analysed video:
 *
 *  - Two unique confirmed sponsors  → qualify immediately (stop analysing).
 *  - Five videos analysed           → qualify if ≥1 sponsor, else reject.
 *  - Four videos, still no sponsor  → reject (don't pay for a fifth).
 *  - Otherwise                      → continue.
 */
export function evaluateQualification(progress: QualificationProgress): QualificationVerdict {
  if (progress.uniqueSponsors.length >= MAX_SPONSORS_BEFORE_STOP) {
    return {
      action: "QUALIFY",
      reason: `Found ${MAX_SPONSORS_BEFORE_STOP} unique confirmed sponsors after ${progress.videosAnalysed} video(s).`,
    };
  }

  if (progress.videosAnalysed >= MAX_VIDEOS_PER_CREATOR) {
    return progress.uniqueSponsors.length > 0
      ? { action: "QUALIFY", reason: `Analysed the maximum ${MAX_VIDEOS_PER_CREATOR} videos with ${progress.uniqueSponsors.length} confirmed sponsor(s).` }
      : { action: "REJECT", reason: `No confirmed sponsor in ${MAX_VIDEOS_PER_CREATOR} analysed videos.` };
  }

  if (progress.videosAnalysed >= NO_SPONSOR_GIVE_UP_AFTER && progress.uniqueSponsors.length === 0) {
    return { action: "REJECT", reason: `No confirmed sponsor in the newest ${NO_SPONSOR_GIVE_UP_AFTER} videos.` };
  }

  return { action: "CONTINUE" };
}

/** Adds a sponsor if it is genuinely new, keeping at most two. Returns whether it was added. */
export function addUniqueSponsor(existing: string[], brandName: string): { sponsors: string[]; added: boolean } {
  const key = normaliseSponsorKey(brandName);
  if (!key) return { sponsors: existing, added: false };
  if (existing.some((s) => normaliseSponsorKey(s) === key)) return { sponsors: existing, added: false };
  return { sponsors: [...existing, brandName].slice(0, MAX_SPONSORS_BEFORE_STOP), added: true };
}
