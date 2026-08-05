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

/**
 * Common TLDs stripped before comparison so a brand written as a domain collapses
 * onto the same key as its display name ("posthog.com" → "posthog").
 */
const DOMAIN_SUFFIXES = [
  "com",
  "io",
  "ai",
  "co",
  "net",
  "org",
  "dev",
  "app",
  "sh",
  "so",
  "xyz",
  "gg",
  "tv",
  "me",
  "cloud",
  "tools",
];

/**
 * Normalises a brand name for uniqueness comparison. Case, spacing and punctuation
 * are irrelevant, and a URL form is the same brand as its display name, so
 * "PostHog", "Post Hog", "posthog.com" and "https://www.posthog.com/" all key to
 * "posthog". A trailing TLD is only stripped when something remains in front of it,
 * so a brand genuinely named "Co" or "AI" survives.
 */
export function normaliseSponsorKey(brandName: string): string {
  let value = brandName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/^[a-z]+:\/\//, "") // protocol
    .replace(/^www\./, "")
    .split(/[/?#]/)[0] // path/query/fragment
    .replace(/[^a-z0-9.]/g, "");

  // Strip trailing TLDs repeatedly so "example.co.uk" reduces to "example".
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const suffix of DOMAIN_SUFFIXES) {
      const ending = `.${suffix}`;
      if (value.endsWith(ending) && value.length > ending.length) {
        value = value.slice(0, -ending.length);
        stripped = true;
        break;
      }
    }
  }

  return value.replace(/\./g, "");
}

export interface QualificationProgress {
  /** Unique confirmed sponsor brand names, in discovery order. */
  uniqueSponsors: string[];
  videosAnalysed: number;
}

export type QualificationVerdict =
  | { action: "CONTINUE" }
  | { action: "QUALIFY"; reason: string }
  | { action: "REJECT"; reason: string };

/** The newest four eligible long-form videos are the whole evidence window. */
export const MAX_VIDEOS_PER_CREATOR = 4;

/**
 * The per-creator stopping rule, evaluated after each analysed video.
 *
 * All four videos are analysed rather than stopping at the first sponsor: the CSV
 * reports *every* unique sponsor in the window, so stopping early would under-report
 * a creator's brand relationships. There is no fifth video under any circumstances.
 *
 *  - Fewer than four analysed → continue.
 *  - Four analysed, ≥1 sponsor → qualify.
 *  - Four analysed, no sponsor → reject.
 */
export function evaluateQualification(progress: QualificationProgress): QualificationVerdict {
  if (progress.videosAnalysed >= MAX_VIDEOS_PER_CREATOR) {
    return progress.uniqueSponsors.length > 0
      ? {
          action: "QUALIFY",
          reason: `Analysed the newest ${MAX_VIDEOS_PER_CREATOR} eligible videos with ${progress.uniqueSponsors.length} confirmed sponsor(s).`,
        }
      : { action: "REJECT", reason: `No confirmed sponsor in the newest ${MAX_VIDEOS_PER_CREATOR} eligible videos.` };
  }

  return { action: "CONTINUE" };
}

/**
 * Adds a sponsor if it is genuinely new. No cap — every unique confirmed sponsor
 * across the four-video window is kept so they can all be exported in one cell.
 */
export function addUniqueSponsor(existing: string[], brandName: string): { sponsors: string[]; added: boolean } {
  const key = normaliseSponsorKey(brandName);
  if (!key) return { sponsors: existing, added: false };
  if (existing.some((s) => normaliseSponsorKey(s) === key)) return { sponsors: existing, added: false };
  return { sponsors: [...existing, brandName], added: true };
}

/**
 * Where one confirmed sponsor was found. Stored in SQL for internal drill-down —
 * deliberately NOT part of the five-column CSV.
 */
export interface SponsorEvidenceEntry {
  brand: string;
  youtubeVideoId: string;
  videoUrl: string;
  publishedAt: string | null;
}

export function youtubeVideoUrl(youtubeVideoId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

/** Merges evidence entries, keeping the first video that proved each brand. */
export function mergeSponsorEvidence(...lists: SponsorEvidenceEntry[][]): SponsorEvidenceEntry[] {
  const byBrand = new Map<string, SponsorEvidenceEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const key = normaliseSponsorKey(entry.brand);
      if (!key || byBrand.has(key)) continue;
      byBrand.set(key, entry);
    }
  }
  return Array.from(byBrand.values());
}

/**
 * Merges two sponsor lists for the same creator, keeping first-seen display names.
 * Used when a channel is discovered under more than one search keyword and its
 * evidence has to be combined into a single creator record.
 */
export function mergeSponsorLists(...lists: string[][]): string[] {
  let merged: string[] = [];
  for (const list of lists) {
    for (const brand of list) {
      merged = addUniqueSponsor(merged, brand).sponsors;
    }
  }
  return merged;
}
