import { describe, expect, it } from "vitest";
import { scoreMatch, type MatchBrandInput, type MatchCreatorInput } from "@/lib/matching/engine";
import { relatednessScore, buyerAudiencesFor } from "@/lib/brand/taxonomy";

const NOW = new Date("2026-08-03T00:00:00Z");

function creator(overrides: Partial<MatchCreatorInput> = {}): MatchCreatorInput {
  return {
    channelName: "Fictional Dev Creator",
    subscriberCount: 150_000,
    nicheWeights: [
      { key: "software_engineers", label: "Software engineers", weight: 0.6, evidence: ["typescript"] },
      { key: "ai_developers", label: "AI developers", weight: 0.4, evidence: ["llm"] },
    ],
    recurringTopics: ["typescript", "llm", "api"],
    technicalDepth: "advanced",
    medianViewsLast25: 40_000,
    avgViewsLast10: 42_000,
    shortsRatio: 0.1,
    viewsPerSubscriber: 0.27,
    engagementRate: 0.035,
    uploadsPerMonth: 4,
    uploadConsistency: 0.85,
    viewTrendRatio: 1.1,
    daysSinceLastUpload: 5,
    sponsorshipFrequency: 0.3,
    sponsoredVideoCount: 6,
    distinctSponsorCount: 4,
    repeatSponsorCount: 1,
    pastSponsors: [{ name: "Codeium", domain: "codeium.com", category: "AI coding tools" }],
    businessEmail: "business@example.com",
    profileCompleteness: 0.9,
    videosConsidered: 25,
    evidenceCount: 15,
    transcriptAvailable: true,
    computedAt: NOW,
    ...overrides,
  };
}

const aiCodingBrand: MatchBrandInput = { name: "Cursor", domain: "cursor.com", category: "AI coding tools", maxBudgetUsd: 5000 };

describe("product taxonomy relatedness (replaces exact category-string equality)", () => {
  it("recognises competing analytics products as related", () => {
    const result = relatednessScore(
      { name: "PostHog", domain: "posthog.com", category: null },
      { name: "Mixpanel", domain: "mixpanel.com", category: null },
    );
    expect(result.score).toBe(1);
    expect(result.reason).toContain("Product analytics");
  });

  it("recognises hosting providers as related to each other", () => {
    expect(relatednessScore({ name: "Railway", domain: null, category: null }, { name: "Vercel", domain: null, category: null }).score).toBe(1);
  });

  it("scores adjacent families partially, not fully", () => {
    const result = relatednessScore(
      { name: "Sentry", domain: "sentry.io", category: null },
      { name: "PostHog", domain: "posthog.com", category: null },
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it("keeps genuinely unrelated products unrelated", () => {
    expect(relatednessScore({ name: "Brilliant", domain: null, category: null }, { name: "Terraform", domain: null, category: null }).score).toBe(0);
  });

  it("maps a brand to its plausible buyer audiences", () => {
    const { audiences } = buyerAudiencesFor(aiCodingBrand);
    expect(audiences).toContain("software_engineers");
    expect(audiences).not.toContain("students_cooking");
  });
});

describe("scoreMatch", () => {
  it("scores a well-evidenced, well-matched creator as a strong match", () => {
    const result = scoreMatch(creator(), aiCodingBrand, undefined, NOW);
    expect(result.matchScore).toBeGreaterThanOrEqual(70);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(65);
    expect(result.recommendation).toBe("STRONG_MATCH");
    expect(result.signals.some((s) => s.code === "RELEVANT_SPONSOR_HISTORY")).toBe(true);
  });

  it("never lets subscriber count alone carry a recommendation", () => {
    // Huge subscriber count but poor long-form performance and a mismatched audience.
    const bigButWrong = creator({
      subscriberCount: 3_000_000,
      medianViewsLast25: 1_500,
      avgViewsLast10: 1_400,
      viewsPerSubscriber: 0.0005,
      nicheWeights: [{ key: "students", label: "Students / learners", weight: 1, evidence: ["study"] }],
      recurringTopics: ["study"],
      pastSponsors: [],
      sponsorshipFrequency: 0,
    });
    const result = scoreMatch(bigButWrong, { name: "Terraform", domain: "terraform.io", category: "Infrastructure as code" }, undefined, NOW);
    expect(result.matchScore).toBeLessThan(50);
    expect(result.signals.some((s) => s.code === "LOW_VIEWS_PER_SUB")).toBe(true);
  });

  it("flags a Shorts-dominant channel so long-form reach is not overstated", () => {
    const result = scoreMatch(creator({ shortsRatio: 0.8 }), aiCodingBrand, undefined, NOW);
    expect(result.signals.some((s) => s.code === "SHORTS_DOMINANT")).toBe(true);
  });

  it("flags declining channels and inactive creators", () => {
    const declining = scoreMatch(creator({ viewTrendRatio: 0.5 }), aiCodingBrand, undefined, NOW);
    expect(declining.signals.some((s) => s.code === "DECLINING_VIEWS")).toBe(true);

    const inactive = scoreMatch(creator({ daysSinceLastUpload: 200 }), aiCodingBrand, undefined, NOW);
    expect(inactive.signals.some((s) => s.code === "INACTIVE")).toBe(true);
  });

  it("flags sponsor saturation", () => {
    const result = scoreMatch(creator({ sponsorshipFrequency: 0.9 }), aiCodingBrand, undefined, NOW);
    expect(result.signals.some((s) => s.code === "SPONSOR_SATURATION")).toBe(true);
  });

  it("flags a direct competitor conflict without automatically rejecting", () => {
    const result = scoreMatch(
      creator({ pastSponsors: [{ name: "GitHub Copilot", domain: "github.com", category: "AI coding tools" }] }),
      aiCodingBrand,
      undefined,
      NOW,
    );
    expect(result.signals.some((s) => s.code === "COMPETITOR_CONFLICT")).toBe(true);
    expect(result.matchScore).toBeGreaterThan(50); // relevant history still counts for something
  });

  it("returns NEEDS_MORE_RESEARCH — not a confident verdict — on thin evidence", () => {
    const thin = creator({
      videosConsidered: 1,
      evidenceCount: 0,
      transcriptAvailable: false,
      profileCompleteness: 0.2,
      pastSponsors: [],
      engagementRate: null,
      viewTrendRatio: null,
      uploadConsistency: null,
      uploadsPerMonth: null,
    });
    const result = scoreMatch(thin, aiCodingBrand, undefined, NOW);
    expect(result.confidenceScore).toBeLessThan(45);
    expect(result.recommendation).toBe("NEEDS_MORE_RESEARCH");
    expect(result.explanation).toContain("Confidence is too low");
  });

  it("separates match quality from evidence quality", () => {
    // Same strong profile, but stale and under-analysed: match stays high, confidence drops.
    const strong = scoreMatch(creator(), aiCodingBrand, undefined, NOW);
    const stale = scoreMatch(
      creator({ videosConsidered: 3, evidenceCount: 1, transcriptAvailable: false, computedAt: new Date("2025-01-01") }),
      aiCodingBrand,
      undefined,
      NOW,
    );
    expect(stale.matchScore).toBeGreaterThan(55);
    expect(stale.confidenceScore).toBeLessThan(strong.confidenceScore);
  });

  it("scores missing data neutrally rather than as zero fit", () => {
    const unknownAudience = creator({ nicheWeights: [], recurringTopics: [] });
    const result = scoreMatch(unknownAudience, aiCodingBrand, undefined, NOW);
    const audience = result.components.find((c) => c.key === "audienceFit");
    expect(audience?.unknown).toBe(true);
    expect(audience?.points).toBe(audience!.maxPoints * 0.5);
    expect(result.signals.some((s) => s.kind === "unknown" && s.code === "AUDIENCE_UNKNOWN")).toBe(true);
  });

  it("rejects a creator with two decisive negative signals", () => {
    const bad = creator({
      nicheWeights: [{ key: "students", label: "Students / learners", weight: 1, evidence: ["study"] }],
      recurringTopics: ["study"],
      viewsPerSubscriber: 0.001,
      subscriberCount: 500_000,
      daysSinceLastUpload: 400,
    });
    const result = scoreMatch(bad, aiCodingBrand, undefined, NOW);
    expect(result.recommendation).toBe("REJECT");
  });

  it("respects configurable weights", () => {
    const audienceHeavy = scoreMatch(creator(), aiCodingBrand, {
      audienceFit: 100,
      contentRelevance: 0,
      sponsorshipHistory: 0,
      commercialIntent: 0,
      viewPerformance: 0,
      engagementQuality: 0,
      brandCompetitorEvidence: 0,
      consistency: 0,
      pricingSuitability: 0,
    }, NOW);
    const audience = audienceHeavy.components.find((c) => c.key === "audienceFit");
    expect(audience?.maxPoints).toBe(100);
    expect(audienceHeavy.matchScore).toBe(Math.round(audience!.points));
  });

  it("explains every recommendation with real numbers", () => {
    const result = scoreMatch(creator(), aiCodingBrand, undefined, NOW);
    expect(result.explanation).toContain("Fictional Dev Creator");
    expect(result.explanation).toContain("/100");
    expect(result.components.every((c) => c.reason.length > 0)).toBe(true);
  });

  it("flags over-budget creators against a campaign budget", () => {
    const expensive = creator({ medianViewsLast25: 900_000 });
    const result = scoreMatch(expensive, { ...aiCodingBrand, maxBudgetUsd: 2000 }, undefined, NOW);
    expect(result.signals.some((s) => s.code === "OVER_BUDGET")).toBe(true);
  });
});
