import { describe, expect, it } from "vitest";
import { evaluateActivity, evaluateFilters, evaluateNiche } from "@/lib/discovery/filters";
import { detectPromotionalSignals } from "@/lib/discovery/signals";
import type { YouTubeChannelResource } from "@/lib/youtube/types";

function channel(overrides: Partial<YouTubeChannelResource> = {}): YouTubeChannelResource {
  return {
    id: "UCfictional000000000000000",
    handle: null,
    title: "Fictional Test Creator",
    description: "A fictional channel about developer tools and coding.",
    thumbnailUrl: null,
    subscriberCount: 100_000,
    hiddenSubscriberCount: false,
    videoCount: 50,
    uploadsPlaylistId: "UUfictional",
    topicCategories: ["https://en.wikipedia.org/wiki/Technology"],
    ...overrides,
  };
}

const settings = { maxSubscribers: 800_000, allowHiddenSubscriberCounts: false };
const noNiche = { nicheKeywords: [], nicheTopicIds: [] };

describe("evaluateFilters", () => {
  it("passes a channel under the subscriber cap with no niche configured", () => {
    const outcome = evaluateFilters({ channel: channel(), niche: noNiche, settings });
    expect(outcome.passed).toBe(true);
    expect(outcome.nicheDecision?.method).toBe("none-configured");
  });

  it("rejects a channel over the 800k cap", () => {
    const outcome = evaluateFilters({ channel: channel({ subscriberCount: 800_001 }), niche: noNiche, settings });
    expect(outcome).toMatchObject({ passed: false, rejectionReason: "SUBSCRIBERS_OVER_CAP" });
  });

  it("passes a channel exactly at the cap (boundary)", () => {
    expect(evaluateFilters({ channel: channel({ subscriberCount: 800_000 }), niche: noNiche, settings }).passed).toBe(true);
  });

  it("rejects hidden subscriber counts by default, allows them when configured", () => {
    const hidden = channel({ hiddenSubscriberCount: true, subscriberCount: null });
    expect(evaluateFilters({ channel: hidden, niche: noNiche, settings })).toMatchObject({
      passed: false,
      rejectionReason: "SUBSCRIBERS_HIDDEN",
    });
    expect(
      evaluateFilters({ channel: hidden, niche: noNiche, settings: { ...settings, allowHiddenSubscriberCounts: true } })
        .passed,
    ).toBe(true);
  });

  it("rejects a niche mismatch with the decision recorded", () => {
    const outcome = evaluateFilters({
      channel: channel({ description: "A fictional cooking channel.", topicCategories: [] }),
      niche: { nicheKeywords: ["coding", "developer"], nicheTopicIds: [] },
      settings,
    });
    expect(outcome).toMatchObject({ passed: false, rejectionReason: "NICHE_MISMATCH" });
    expect(outcome.nicheDecision?.passed).toBe(false);
  });
});

describe("evaluateNiche", () => {
  it("matches by topic category first", () => {
    const decision = evaluateNiche(channel(), { nicheKeywords: [], nicheTopicIds: ["wiki/Technology"] });
    expect(decision).toMatchObject({ method: "topic", passed: true });
    expect(decision.matched).toHaveLength(1);
  });

  it("falls back to keyword matching with word boundaries", () => {
    const decision = evaluateNiche(channel({ topicCategories: [] }), {
      nicheKeywords: ["coding"],
      nicheTopicIds: ["wiki/Music"],
    });
    expect(decision).toMatchObject({ method: "keyword", passed: true, matched: ["coding"] });
    // "cod" must NOT match inside "coding" — word boundary required.
    expect(
      evaluateNiche(channel({ topicCategories: [] }), { nicheKeywords: ["cod"], nicheTopicIds: [] }).passed,
    ).toBe(false);
  });
});

describe("evaluateActivity", () => {
  const activitySettings = { maxVideoAgeDays: 90 };

  it("rejects a channel with no uploads", () => {
    expect(evaluateActivity(null, activitySettings).passed).toBe(false);
  });

  it("rejects a stale channel and passes an active one", () => {
    const now = new Date("2026-08-02T00:00:00Z");
    expect(evaluateActivity(new Date("2026-04-01T00:00:00Z"), activitySettings, now).passed).toBe(false);
    expect(evaluateActivity(new Date("2026-07-20T00:00:00Z"), activitySettings, now).passed).toBe(true);
  });
});

describe("detectPromotionalSignals", () => {
  it("finds nothing in a plain description", () => {
    const result = detectPromotionalSignals({ description: "Just a vlog about my week.", paidProductPlacement: false });
    expect(result.hasPromotionalSignals).toBe(false);
    expect(result.matchedClasses).toEqual([]);
  });

  it("detects discount codes and affiliate disclosures", () => {
    const result = detectPromotionalSignals({
      description: "Use code SAVE10 for 10% off. Some links are affiliate links.",
      paidProductPlacement: false,
    });
    expect(result.hasPromotionalSignals).toBe(true);
    expect(result.matchedClasses).toContain("discount-codes");
    expect(result.matchedClasses).toContain("affiliate-disclosure");
  });

  it("detects the paid-product-placement metadata flag alone", () => {
    const result = detectPromotionalSignals({ description: "Plain description.", paidProductPlacement: true });
    expect(result.hasPromotionalSignals).toBe(true);
    expect(result.matchedClasses).toEqual(["paid-product-placement-flag"]);
  });

  it("detects UTM/affiliate campaign parameters in links", () => {
    const result = detectPromotionalSignals({
      description: "Check out https://example.com/product?utm_source=creator&utm_campaign=spring",
      paidProductPlacement: false,
    });
    expect(result.hasPromotionalSignals).toBe(true);
    expect(result.matchedClasses).toContain("campaign-parameters");
  });
});
