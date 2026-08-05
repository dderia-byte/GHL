import { buyerAudiencesFor, relatednessScore } from "@/lib/brand/taxonomy";
import type { CategoryWeight } from "@/lib/creator-profile/classification";
import {
  DEFAULT_MATCH_WEIGHTS,
  type MatchResult,
  type MatchSignal,
  type MatchWeights,
  type Recommendation,
  type ScoreComponent,
} from "./types";

export interface MatchCreatorInput {
  channelName: string;
  subscriberCount: number | null;
  /** Weighted audience categories derived from the creator's own content. */
  nicheWeights: CategoryWeight[];
  recurringTopics: string[];
  technicalDepth: "beginner" | "intermediate" | "advanced" | null;

  medianViewsLast25: number | null;
  avgViewsLast10: number | null;
  shortsRatio: number | null;
  viewsPerSubscriber: number | null;
  engagementRate: number | null;
  uploadsPerMonth: number | null;
  uploadConsistency: number | null;
  viewTrendRatio: number | null;
  daysSinceLastUpload: number | null;

  sponsorshipFrequency: number | null;
  sponsoredVideoCount: number;
  distinctSponsorCount: number;
  repeatSponsorCount: number;
  /** Brands that have sponsored this creator, for relevance and conflict checks. */
  pastSponsors: Array<{ name: string; domain: string | null; category: string | null }>;

  businessEmail: string | null;
  profileCompleteness: number | null;
  videosConsidered: number;
  /** Independent evidence records behind the creator's detections. */
  evidenceCount: number;
  transcriptAvailable: boolean;
  computedAt: Date | null;
}

export interface MatchBrandInput {
  name: string;
  domain: string | null;
  category: string | null;
  /** Optional campaign budget ceiling per placement, in USD. */
  maxBudgetUsd?: number | null;
}

/** Rough industry heuristic: sponsored integrations commonly price near a $20–40 CPM. */
const ASSUMED_CPM_USD = 25;

export function estimateSponsorshipRateUsd(medianLongFormViews: number | null): { low: number; high: number } | null {
  if (medianLongFormViews === null || medianLongFormViews <= 0) return null;
  const mid = (medianLongFormViews / 1000) * ASSUMED_CPM_USD;
  return { low: Math.round(mid * 0.6), high: Math.round(mid * 1.5) };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Scores one creator against one brand across nine weighted dimensions, and separately
 * scores how much the underlying evidence can be trusted.
 *
 * Design rules, all of which the previous single-score system violated:
 *  - Subscriber count is never a scoring input on its own; long-form view performance is.
 *  - Missing data scores NEUTRALLY (half the available points) and is flagged as an
 *    unknown signal — it is never treated as a zero, which would silently reject
 *    creators for being under-researched rather than unsuitable.
 *  - Every component records the numbers behind it, so a recommendation can be defended.
 */
export function scoreMatch(
  creator: MatchCreatorInput,
  brand: MatchBrandInput,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
  now: Date = new Date(),
): MatchResult {
  const components: ScoreComponent[] = [];
  const signals: MatchSignal[] = [];

  const { audiences: brandAudiences, families } = buyerAudiencesFor(brand);

  // --- 1. Audience fit ---------------------------------------------------------
  {
    const max = weights.audienceFit;
    if (creator.nicheWeights.length === 0 || brandAudiences.length === 0) {
      components.push({
        key: "audienceFit",
        label: "Audience fit",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason:
          creator.nicheWeights.length === 0
            ? "The creator's audience could not be classified from their content — scored neutrally."
            : `No known buyer audience for ${brand.name} — scored neutrally.`,
      });
      signals.push({
        kind: "unknown",
        code: "AUDIENCE_UNKNOWN",
        message: "Audience fit could not be established from available evidence.",
        severity: 2,
      });
    } else {
      // Share of the creator's audience that plausibly buys this product category.
      const overlap = creator.nicheWeights
        .filter((n) => brandAudiences.includes(n.key))
        .reduce((sum, n) => sum + n.weight, 0);
      const points = max * clamp01(overlap);
      const matched = creator.nicheWeights.filter((n) => brandAudiences.includes(n.key));
      components.push({
        key: "audienceFit",
        label: "Audience fit",
        points,
        maxPoints: max,
        unknown: false,
        reason: matched.length
          ? `${Math.round(overlap * 100)}% of the audience profile (${matched.map((m) => `${m.label} ${Math.round(m.weight * 100)}%`).join(", ")}) matches buyers of ${families.join(" / ") || brand.name}.`
          : `The audience (${creator.nicheWeights.map((n) => n.label).join(", ")}) does not overlap with typical buyers of ${families.join(" / ") || brand.name}.`,
      });

      if (overlap < 0.15) {
        signals.push({
          kind: "negative",
          code: "AUDIENCE_MISMATCH",
          message: `Audience is ${creator.nicheWeights[0]?.label ?? "unclear"}, not a typical buyer of ${brand.name}.`,
          severity: 3,
        });
      } else if (overlap >= 0.5) {
        signals.push({
          kind: "positive",
          code: "AUDIENCE_STRONG",
          message: `${Math.round(overlap * 100)}% of the audience are plausible buyers.`,
          severity: 3,
        });
      }
    }
  }

  // --- 2. Content relevance ----------------------------------------------------
  {
    const max = weights.contentRelevance;
    const brandTerms = [brand.name, brand.category ?? "", ...families].map((t) => t.toLowerCase()).filter(Boolean);
    const topicHits = creator.recurringTopics.filter((topic) =>
      brandTerms.some((term) => term.includes(topic.toLowerCase()) || topic.toLowerCase().includes(term)),
    );

    if (creator.recurringTopics.length === 0) {
      components.push({
        key: "contentRelevance",
        label: "Content relevance",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "No recurring topics could be derived — scored neutrally.",
      });
    } else {
      // Relevance is driven by the audience-family alignment plus direct topic hits.
      const familyAlignment = creator.nicheWeights
        .filter((n) => brandAudiences.includes(n.key))
        .reduce((sum, n) => sum + n.weight, 0);
      const topicBoost = topicHits.length > 0 ? 0.25 : 0;
      const points = max * clamp01(familyAlignment * 0.75 + topicBoost);
      components.push({
        key: "contentRelevance",
        label: "Content relevance",
        points,
        maxPoints: max,
        unknown: false,
        reason: topicHits.length
          ? `Recurring topics directly related to the product: ${topicHits.slice(0, 5).join(", ")}.`
          : `Recurring topics (${creator.recurringTopics.slice(0, 5).join(", ")}) are ${familyAlignment > 0.3 ? "broadly" : "only loosely"} aligned with ${brand.name}.`,
      });
    }
  }

  // --- 3. Sponsorship history relevance ---------------------------------------
  {
    const max = weights.sponsorshipHistory;
    if (creator.pastSponsors.length === 0) {
      components.push({
        key: "sponsorshipHistory",
        label: "Sponsorship history",
        points: creator.videosConsidered > 0 ? 0 : max * 0.5,
        maxPoints: max,
        unknown: creator.videosConsidered === 0,
        reason:
          creator.videosConsidered > 0
            ? "No sponsorships found in the analysed videos — unproven commercially."
            : "No videos analysed yet — sponsorship history unknown.",
      });
      if (creator.videosConsidered > 0) {
        signals.push({
          kind: "negative",
          code: "NO_SPONSOR_HISTORY",
          message: "No sponsorships detected in the analysed window.",
          severity: 2,
        });
      }
    } else {
      const relatedness = creator.pastSponsors.map((s) => relatednessScore(s, brand));
      const best = relatedness.reduce((a, b) => (b.score > a.score ? b : a));
      const relevantCount = relatedness.filter((r) => r.score > 0).length;

      // Any sponsorship history is worth something; category-relevant history is worth more.
      const base = 0.4;
      const relevanceBonus = 0.6 * best.score;
      const points = max * clamp01(base + relevanceBonus);

      components.push({
        key: "sponsorshipHistory",
        label: "Sponsorship history",
        points,
        maxPoints: max,
        unknown: false,
        reason:
          best.score >= 1
            ? `Has run sponsorships for directly comparable products (${creator.pastSponsors.map((s) => s.name).slice(0, 3).join(", ")}). ${best.reason}`
            : best.score > 0
              ? `Has sponsorship history in an adjacent category. ${best.reason}`
              : `Has ${creator.pastSponsors.length} prior sponsor(s) (${creator.pastSponsors.map((s) => s.name).slice(0, 3).join(", ")}), none in this product family.`,
      });

      if (relevantCount > 0) {
        signals.push({
          kind: "positive",
          code: "RELEVANT_SPONSOR_HISTORY",
          message: `Previously sponsored by ${relevantCount} comparable product(s) — proven fit for this category.`,
          severity: 3,
        });
      }
      if (creator.repeatSponsorCount > 0) {
        signals.push({
          kind: "positive",
          code: "REPEAT_SPONSORS",
          message: `${creator.repeatSponsorCount} brand(s) sponsored more than once — sponsors renew with this creator.`,
          severity: 3,
        });
      }

      // Direct competitor conflict.
      const conflict = creator.pastSponsors.find((s) => relatednessScore(s, brand).score >= 1);
      if (conflict) {
        signals.push({
          kind: "negative",
          code: "COMPETITOR_CONFLICT",
          message: `Has promoted ${conflict.name}, a direct competitor — check exclusivity before approaching.`,
          severity: 2,
        });
      }
    }
  }

  // --- 4. Commercial intent (is the audience in a buying posture?) -------------
  {
    const max = weights.commercialIntent;
    if (creator.sponsorshipFrequency === null) {
      components.push({
        key: "commercialIntent",
        label: "Commercial intent",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "Sponsorship frequency unknown — scored neutrally.",
      });
    } else {
      // A creator who never sponsors is unproven; one who sponsors constantly saturates
      // their audience. The sweet spot is regular but not relentless.
      const f = creator.sponsorshipFrequency;
      const ratio = f === 0 ? 0.15 : f <= 0.5 ? 1 : f <= 0.7 ? 0.6 : 0.25;
      components.push({
        key: "commercialIntent",
        label: "Commercial intent",
        points: max * ratio,
        maxPoints: max,
        unknown: false,
        reason: `${Math.round(f * 100)}% of analysed long-form videos carry a sponsorship${f > 0.7 ? " — heavily saturated" : f === 0 ? " — no commercial track record" : ""}.`,
      });
      if (f > 0.7) {
        signals.push({
          kind: "negative",
          code: "SPONSOR_SATURATION",
          message: `${Math.round(f * 100)}% of videos are sponsored — audience receptiveness is likely reduced.`,
          severity: 2,
        });
      }
    }
  }

  // --- 5. View performance (long-form only) -----------------------------------
  {
    const max = weights.viewPerformance;
    const views = creator.medianViewsLast25 ?? creator.avgViewsLast10;
    if (views === null) {
      components.push({
        key: "viewPerformance",
        label: "View performance",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "No long-form view data available — scored neutrally.",
      });
      signals.push({
        kind: "unknown",
        code: "VIEWS_UNKNOWN",
        message: "Long-form view performance is unknown.",
        severity: 2,
      });
    } else {
      // log scale: 1k views ≈ 0.25, 10k ≈ 0.5, 100k ≈ 0.75, 1M ≈ 1.
      const scaled = clamp01((Math.log10(Math.max(views, 1)) - 2) / 4 + 0.25);
      components.push({
        key: "viewPerformance",
        label: "View performance",
        points: max * scaled,
        maxPoints: max,
        unknown: false,
        reason: `Median long-form views: ${Math.round(views).toLocaleString("en-US")}${creator.shortsRatio !== null && creator.shortsRatio > 0.5 ? " (long-form only; this channel is Shorts-heavy)" : ""}.`,
      });

      if (creator.shortsRatio !== null && creator.shortsRatio > 0.6) {
        signals.push({
          kind: "negative",
          code: "SHORTS_DOMINANT",
          message: `${Math.round(creator.shortsRatio * 100)}% of uploads are Shorts — headline view counts do not reflect long-form sponsorship reach.`,
          severity: 2,
        });
      }
      if (creator.viewsPerSubscriber !== null && creator.viewsPerSubscriber < 0.02 && (creator.subscriberCount ?? 0) > 50_000) {
        signals.push({
          kind: "negative",
          code: "LOW_VIEWS_PER_SUB",
          message: `Median long-form views are only ${(creator.viewsPerSubscriber * 100).toFixed(1)}% of the subscriber count — the audience may be inactive.`,
          severity: 3,
        });
      }
      if (creator.viewTrendRatio !== null && creator.viewTrendRatio < 0.7) {
        signals.push({
          kind: "negative",
          code: "DECLINING_VIEWS",
          message: `Recent views are ${Math.round((1 - creator.viewTrendRatio) * 100)}% below the earlier baseline — the channel is declining.`,
          severity: 2,
        });
      } else if (creator.viewTrendRatio !== null && creator.viewTrendRatio > 1.3) {
        signals.push({
          kind: "positive",
          code: "GROWING_VIEWS",
          message: `Recent views are up ${Math.round((creator.viewTrendRatio - 1) * 100)}% on the earlier baseline.`,
          severity: 2,
        });
      }
    }
  }

  // --- 6. Engagement quality ---------------------------------------------------
  {
    const max = weights.engagementQuality;
    if (creator.engagementRate === null) {
      components.push({
        key: "engagementQuality",
        label: "Engagement quality",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "Engagement data unavailable — scored neutrally.",
      });
    } else {
      // ~4% (likes+comments)/views is a strong YouTube engagement rate.
      const scaled = clamp01(creator.engagementRate / 0.04);
      components.push({
        key: "engagementQuality",
        label: "Engagement quality",
        points: max * scaled,
        maxPoints: max,
        unknown: false,
        reason: `Engagement rate ${(creator.engagementRate * 100).toFixed(2)}% of views.`,
      });
    }
  }

  // --- 7. Brand & competitor evidence -----------------------------------------
  {
    const max = weights.brandCompetitorEvidence;
    const mentionsBrand = creator.recurringTopics.some((t) => t.toLowerCase().includes(brand.name.toLowerCase()));
    const competitorSponsor = creator.pastSponsors.some((s) => relatednessScore(s, brand).score >= 1);
    const points = competitorSponsor ? max : mentionsBrand ? max * 0.7 : max * 0.3;
    components.push({
      key: "brandCompetitorEvidence",
      label: "Brand & competitor evidence",
      points,
      maxPoints: max,
      unknown: false,
      reason: competitorSponsor
        ? "Has already been paid to promote a directly comparable product."
        : mentionsBrand
          ? `Covers ${brand.name} or its category organically.`
          : "No direct brand or competitor evidence found.",
    });
  }

  // --- 8. Consistency ----------------------------------------------------------
  {
    const max = weights.consistency;
    if (creator.uploadConsistency === null && creator.uploadsPerMonth === null) {
      components.push({
        key: "consistency",
        label: "Upload consistency",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "Upload cadence unknown — scored neutrally.",
      });
    } else {
      const consistency = creator.uploadConsistency ?? 0.5;
      const cadenceOk = (creator.uploadsPerMonth ?? 0) >= 1;
      const points = max * clamp01(consistency * (cadenceOk ? 1 : 0.5));
      components.push({
        key: "consistency",
        label: "Upload consistency",
        points,
        maxPoints: max,
        unknown: false,
        reason: `${creator.uploadsPerMonth !== null ? `${creator.uploadsPerMonth.toFixed(1)} long-form uploads/month` : "cadence unknown"}, regularity ${Math.round(consistency * 100)}%.`,
      });

      if (creator.daysSinceLastUpload !== null && creator.daysSinceLastUpload > 90) {
        signals.push({
          kind: "negative",
          code: "INACTIVE",
          message: `No long-form upload for ${creator.daysSinceLastUpload} days — the creator may be inactive.`,
          severity: 3,
        });
      }
    }
  }

  // --- 9. Pricing suitability --------------------------------------------------
  {
    const max = weights.pricingSuitability;
    const rate = estimateSponsorshipRateUsd(creator.medianViewsLast25);
    if (rate === null) {
      components.push({
        key: "pricingSuitability",
        label: "Pricing suitability",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: "Cannot estimate a rate without long-form view data — scored neutrally.",
      });
    } else if (brand.maxBudgetUsd === null || brand.maxBudgetUsd === undefined) {
      components.push({
        key: "pricingSuitability",
        label: "Pricing suitability",
        points: max * 0.5,
        maxPoints: max,
        unknown: true,
        reason: `Estimated rate $${rate.low.toLocaleString("en-US")}–$${rate.high.toLocaleString("en-US")} per integration; no campaign budget set to compare against.`,
      });
    } else {
      const withinBudget = rate.low <= brand.maxBudgetUsd;
      const comfortably = rate.high <= brand.maxBudgetUsd;
      components.push({
        key: "pricingSuitability",
        label: "Pricing suitability",
        points: comfortably ? max : withinBudget ? max * 0.6 : 0,
        maxPoints: max,
        unknown: false,
        reason: `Estimated $${rate.low.toLocaleString("en-US")}–$${rate.high.toLocaleString("en-US")} vs budget $${brand.maxBudgetUsd.toLocaleString("en-US")}.`,
      });
      if (!withinBudget) {
        signals.push({
          kind: "negative",
          code: "OVER_BUDGET",
          message: `Estimated rate (from $${rate.low.toLocaleString("en-US")}) exceeds the campaign budget.`,
          severity: 2,
        });
      }
    }
  }

  // --- Contactability (a signal, not a score component) ------------------------
  if (!creator.businessEmail) {
    signals.push({
      kind: "unknown",
      code: "NO_CONTACT",
      message: "No business email found in public descriptions — outreach route unconfirmed.",
      severity: 1,
    });
  } else {
    signals.push({
      kind: "positive",
      code: "CONTACTABLE",
      message: `Business contact available (${creator.businessEmail}).`,
      severity: 1,
    });
  }

  const matchScore = Math.round(components.reduce((sum, c) => sum + c.points, 0));
  const confidenceScore = computeConfidence(creator, components, now);
  const recommendation = decideRecommendation(matchScore, confidenceScore, signals);

  return {
    matchScore,
    confidenceScore,
    recommendation,
    components,
    signals,
    explanation: buildExplanation(creator, brand, matchScore, confidenceScore, recommendation, components, signals),
  };
}

/**
 * Confidence measures how much the score can be trusted — deliberately independent of
 * how good the match looks. A creator can be a 91/100 match on 40/100 confidence, and
 * a human must be able to see that before acting on it.
 */
function computeConfidence(creator: MatchCreatorInput, components: ScoreComponent[], now: Date): number {
  let score = 0;

  // Breadth of analysis (max 30).
  score += Math.min(30, creator.videosConsidered * 3);

  // Independent evidence records behind detections (max 20).
  score += Math.min(20, creator.evidenceCount * 2);

  // Transcript availability materially improves sponsorship detection (10).
  if (creator.transcriptAvailable) score += 10;

  // How much of the profile could be computed (max 20).
  score += Math.round((creator.profileCompleteness ?? 0) * 20);

  // Penalty for dimensions scored on missing data (up to -20).
  const unknownCount = components.filter((c) => c.unknown).length;
  score -= Math.min(20, unknownCount * 5);

  // Freshness (max 20, decaying after 30 days).
  if (creator.computedAt) {
    const ageDays = (now.getTime() - creator.computedAt.getTime()) / (24 * 3600 * 1000);
    score += ageDays <= 30 ? 20 : ageDays <= 90 ? 10 : 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Converts the two scores plus decisive signals into a recommendation. Low confidence
 * can never produce a "strong match" — it produces "needs more research", which is
 * exactly what an experienced researcher would say.
 */
function decideRecommendation(matchScore: number, confidenceScore: number, signals: MatchSignal[]): Recommendation {
  const decisiveNegatives = signals.filter((s) => s.kind === "negative" && s.severity === 3);
  if (decisiveNegatives.length >= 2) return "REJECT";
  if (matchScore < 35) return "REJECT";
  if (confidenceScore < 45) return "NEEDS_MORE_RESEARCH";
  if (matchScore >= 75 && confidenceScore >= 65 && decisiveNegatives.length === 0) return "STRONG_MATCH";
  if (matchScore >= 60) return "GOOD_MATCH";
  return "WEAK_MATCH";
}

function buildExplanation(
  creator: MatchCreatorInput,
  brand: MatchBrandInput,
  matchScore: number,
  confidenceScore: number,
  recommendation: Recommendation,
  components: ScoreComponent[],
  signals: MatchSignal[],
): string {
  const top = [...components].sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints).slice(0, 2);
  const negatives = signals.filter((s) => s.kind === "negative").sort((a, b) => b.severity - a.severity);
  const unknowns = signals.filter((s) => s.kind === "unknown");

  const parts: string[] = [
    `${creator.channelName} scores ${matchScore}/100 for ${brand.name} with ${confidenceScore}/100 confidence.`,
  ];
  if (top.length) parts.push(`Strongest factors: ${top.map((c) => c.reason).join(" ")}`);
  if (negatives.length) parts.push(`Concerns: ${negatives.slice(0, 3).map((s) => s.message).join(" ")}`);
  if (unknowns.length) parts.push(`Unknowns: ${unknowns.map((s) => s.message).join(" ")}`);
  if (recommendation === "NEEDS_MORE_RESEARCH") {
    parts.push("Confidence is too low to act on — analyse more videos or supply a transcript before deciding.");
  }
  return parts.join(" ");
}
