import { slugifyBrandToken } from "./normalize";

export interface CreatorOpportunityInput {
  channelCategory: string | null;
  recentTitles: string[];
  recentDescriptions: string[];
  brandCategory: string | null;
  pastSponsorCategories: string[];
  pastSponsorBrandNames: string[];
  competitorBrandNames: string[];
  averageRecentViews: number | null;
  subscriberCount: number | null;
  sponsoredVideoCount: number;
  totalVideosAnalysed: number;
}

export interface CreatorOpportunityResult {
  opportunityScore: number;
  reason: string;
  conflictWarning: string | null;
}

function categoryMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return slugifyBrandToken(a) === slugifyBrandToken(b);
}

function textMentionsCategory(texts: string[], category: string | null): boolean {
  if (!category) return false;
  const needle = category.toLowerCase();
  return texts.some((t) => t.toLowerCase().includes(needle));
}

/**
 * Rule-based (no embeddings) opportunity scoring for whether a monitored creator
 * suits a given brand. Combines category alignment, topical relevance in recent
 * titles/descriptions, prior sponsorship history, audience size, and sponsorship
 * frequency, then flags a conflict warning if the creator has previously promoted
 * a known competitor.
 */
export function scoreCreatorOpportunity(input: CreatorOpportunityInput): CreatorOpportunityResult {
  let score = 35;
  const reasons: string[] = [];

  if (categoryMatches(input.channelCategory, input.brandCategory)) {
    score += 20;
    reasons.push(`channel category (${input.channelCategory}) matches the brand's category`);
  } else if (textMentionsCategory([...input.recentTitles, ...input.recentDescriptions], input.brandCategory)) {
    score += 10;
    reasons.push("recent video topics are relevant to the brand's category");
  }

  const overlappingSponsorCategory = input.pastSponsorCategories.some((c) => categoryMatches(c, input.brandCategory));
  if (overlappingSponsorCategory) {
    score += 15;
    reasons.push("has previously run sponsorships in this category");
  }

  if (input.subscriberCount !== null && input.subscriberCount > 0) {
    const scaled = Math.min(10, Math.log10(input.subscriberCount + 1) * 2);
    score += scaled;
  }
  if (input.averageRecentViews !== null && input.averageRecentViews > 0) {
    const scaled = Math.min(10, Math.log10(input.averageRecentViews + 1) * 2);
    score += scaled;
    reasons.push("has a healthy recent average view count");
  }

  if (input.totalVideosAnalysed > 0) {
    const frequency = input.sponsoredVideoCount / input.totalVideosAnalysed;
    if (frequency > 0 && frequency <= 0.6) {
      score += 8;
      reasons.push("regularly runs sponsored content without over-saturating their audience");
    } else if (frequency > 0.6) {
      score -= 5;
      reasons.push("runs sponsored content very frequently, which may reduce audience receptiveness");
    }
  }

  const conflictBrand = input.pastSponsorBrandNames.find((name) =>
    input.competitorBrandNames.some((c) => slugifyBrandToken(c) === slugifyBrandToken(name)),
  );
  let conflictWarning: string | null = null;
  if (conflictBrand) {
    score -= 25;
    conflictWarning = `This creator has previously promoted ${conflictBrand}, a known competitor.`;
  }

  const opportunityScore = Math.max(0, Math.min(100, Math.round(score)));
  const reason = reasons.length ? reasons.join("; ") : "Limited signal available; based on general audience fit.";

  return { opportunityScore, reason, conflictWarning };
}
