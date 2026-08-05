import { describe, expect, it } from "vitest";
import { evaluateActivity, evaluateFilters } from "@/lib/discovery/filters";
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

describe("evaluateFilters", () => {
  it("passes a channel under the subscriber cap", () => {
    expect(evaluateFilters({ channel: channel(), settings }).passed).toBe(true);
  });

  it("rejects a channel over the 800k cap", () => {
    const outcome = evaluateFilters({ channel: channel({ subscriberCount: 800_001 }), settings });
    expect(outcome).toMatchObject({ passed: false, rejectionReason: "SUBSCRIBERS_OVER_CAP" });
  });

  it("passes a channel exactly at the cap (boundary)", () => {
    expect(evaluateFilters({ channel: channel({ subscriberCount: 800_000 }), settings }).passed).toBe(true);
  });

  it("rejects hidden subscriber counts by default, allows them when configured", () => {
    const hidden = channel({ hiddenSubscriberCount: true, subscriberCount: null });
    expect(evaluateFilters({ channel: hidden, settings })).toMatchObject({
      passed: false,
      rejectionReason: "SUBSCRIBERS_HIDDEN",
    });
    expect(
      evaluateFilters({ channel: hidden, settings: { ...settings, allowHiddenSubscriberCounts: true } }).passed,
    ).toBe(true);
  });

  it("never rejects on niche — the YouTube search text is the only niche definition", () => {
    // A cooking channel found by a coding query is still returned: the search text
    // already decided relevance, and a second keyword gate only loses creators.
    const offTopic = channel({ description: "A fictional cooking channel.", topicCategories: [] });
    expect(evaluateFilters({ channel: offTopic, settings }).passed).toBe(true);
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
