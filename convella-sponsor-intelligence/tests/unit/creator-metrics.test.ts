import { describe, expect, it } from "vitest";
import {
  computeCadence,
  computeCommercialStats,
  computeEngagement,
  computeViewStats,
  computeViewTrend,
  computeViewsPerSubscriber,
  median,
  sortNewestFirst,
  splitByFormat,
  type ProfileVideoInput,
} from "@/lib/creator-profile/metrics";

function v(overrides: Partial<ProfileVideoInput> & { id: string }): ProfileVideoInput {
  return {
    durationSeconds: 600,
    viewCount: 10_000,
    likeCount: 500,
    commentCount: 50,
    publishedAt: new Date("2026-07-01T00:00:00Z"),
    hasSponsorship: false,
    sponsorBrands: [],
    ...overrides,
  };
}

describe("splitByFormat", () => {
  it("separates Shorts from long-form so Shorts never inflate performance", () => {
    const split = splitByFormat([
      v({ id: "short1", durationSeconds: 45 }),
      v({ id: "short2", durationSeconds: 180 }), // exactly at the limit = Short
      v({ id: "long1", durationSeconds: 181 }),
      v({ id: "long2", durationSeconds: 900 }),
    ]);
    expect(split.shorts.map((s) => s.id)).toEqual(["short1", "short2"]);
    expect(split.longForm.map((l) => l.id)).toEqual(["long1", "long2"]);
    expect(split.shortsRatio).toBe(0.5);
  });

  it("excludes unknown-duration videos from both buckets rather than guessing", () => {
    const split = splitByFormat([v({ id: "a", durationSeconds: null }), v({ id: "b", durationSeconds: 600 })]);
    expect(split.longForm.map((l) => l.id)).toEqual(["b"]);
    expect(split.shorts).toHaveLength(0);
    expect(split.shortsRatio).toBe(0);
  });

  it("returns unknown (null) shortsRatio when no durations are known at all", () => {
    expect(splitByFormat([v({ id: "a", durationSeconds: null })]).shortsRatio).toBeNull();
  });

  it("a Shorts-dominant channel's long-form views are unaffected by viral Shorts", () => {
    const videos = [
      v({ id: "s1", durationSeconds: 30, viewCount: 900_000 }),
      v({ id: "s2", durationSeconds: 30, viewCount: 800_000 }),
      v({ id: "l1", durationSeconds: 600, viewCount: 3_000 }),
      v({ id: "l2", durationSeconds: 600, viewCount: 3_400 }),
    ];
    const { longForm } = splitByFormat(videos);
    const stats = computeViewStats(sortNewestFirst(longForm));
    expect(stats.avgViewsLast10).toBe(3_200); // NOT ~426,600
  });
});

describe("computeViewStats", () => {
  it("computes averages and median over the correct windows", () => {
    // i=0 is the OLDEST (1 July, 1k views); i=24 is the newest (25 July, 25k views).
    const videos = Array.from({ length: 25 }, (_, i) =>
      v({ id: `v${i}`, viewCount: (i + 1) * 1000, publishedAt: new Date(2026, 6, i + 1) }),
    );
    const stats = computeViewStats(sortNewestFirst(videos));
    // Newest first => 25000, 24000 ... 16000 for the first ten, mean 20500.
    expect(stats.avgViewsLast10).toBe(20_500);
    expect(stats.avgViewsLast25).toBe(13_000);
    expect(stats.medianViewsLast25).toBe(13_000);
    expect(stats.highestRecentViews).toBe(25_000);
    expect(stats.lowestRecentViews).toBe(1_000);
  });

  it("median resists a single viral outlier that skews the mean", () => {
    const views = [1000, 1100, 1200, 1300, 900_000];
    expect(median(views)).toBe(1200);
  });

  it("returns unknown rather than zero when no views are available", () => {
    const stats = computeViewStats([v({ id: "a", viewCount: null })]);
    expect(stats.avgViewsLast10).toBeNull();
    expect(stats.medianViewsLast25).toBeNull();
  });
});

describe("computeEngagement", () => {
  it("computes engagement rate from likes and comments over views", () => {
    const result = computeEngagement([v({ id: "a", viewCount: 1000, likeCount: 80, commentCount: 20 })]);
    expect(result.engagementRate).toBeCloseTo(0.1);
  });

  it("does not read hidden likes as zero engagement", () => {
    const result = computeEngagement([v({ id: "a", viewCount: 1000, likeCount: null, commentCount: null })]);
    expect(result.engagementRate).toBeNull();
    expect(result.avgLikes).toBeNull();
  });
});

describe("computeCadence", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("computes uploads per month and days since last upload", () => {
    const videos = [
      v({ id: "a", publishedAt: new Date("2026-07-29T00:00:00Z") }),
      v({ id: "b", publishedAt: new Date("2026-07-22T00:00:00Z") }),
      v({ id: "c", publishedAt: new Date("2026-07-15T00:00:00Z") }),
      v({ id: "d", publishedAt: new Date("2026-07-08T00:00:00Z") }),
    ];
    const cadence = computeCadence(sortNewestFirst(videos), now);
    expect(cadence.daysSinceLastUpload).toBe(3);
    expect(cadence.uploadsPerMonth).toBeCloseTo((4 / 21) * 30, 1);
    // Perfectly regular weekly uploads => consistency ~1.
    expect(cadence.uploadConsistency).toBeCloseTo(1, 5);
  });

  it("scores an erratic uploader far below a regular one", () => {
    const erratic = [
      v({ id: "a", publishedAt: new Date("2026-07-30T00:00:00Z") }),
      v({ id: "b", publishedAt: new Date("2026-07-29T00:00:00Z") }),
      v({ id: "c", publishedAt: new Date("2026-01-01T00:00:00Z") }),
    ];
    const result = computeCadence(sortNewestFirst(erratic), now);
    expect(result.uploadConsistency).toBeLessThan(0.3);
  });

  it("returns unknown when there are no publish dates", () => {
    const result = computeCadence([v({ id: "a", publishedAt: null })], now);
    expect(result).toMatchObject({ uploadsPerMonth: null, daysSinceLastUpload: null, uploadConsistency: null });
  });
});

describe("computeViewTrend", () => {
  const dated = (i: number, views: number) =>
    v({ id: `v${i}`, viewCount: views, publishedAt: new Date(2026, 6, 30 - i) });

  it("detects a declining channel", () => {
    // Newest first: recent videos underperform older ones.
    const videos = [dated(0, 1000), dated(1, 1100), dated(2, 1200), dated(3, 5000), dated(4, 5200), dated(5, 5400)];
    const trend = computeViewTrend(sortNewestFirst(videos));
    expect(trend).not.toBeNull();
    expect(trend as number).toBeLessThan(1);
  });

  it("detects a growing channel", () => {
    const videos = [dated(0, 9000), dated(1, 8000), dated(2, 7000), dated(3, 2000), dated(4, 1800), dated(5, 1500)];
    expect(computeViewTrend(sortNewestFirst(videos)) as number).toBeGreaterThan(1);
  });

  it("refuses to call a trend on too small a sample", () => {
    expect(computeViewTrend([dated(0, 100), dated(1, 200)])).toBeNull();
  });
});

describe("computeCommercialStats", () => {
  it("computes frequency, distinct and repeat sponsors over long-form only", () => {
    const videos = [
      v({ id: "a", hasSponsorship: true, sponsorBrands: ["nimbus"], publishedAt: new Date("2026-07-20") }),
      v({ id: "b", hasSponsorship: true, sponsorBrands: ["nimbus"], publishedAt: new Date("2026-07-10") }),
      v({ id: "c", hasSponsorship: true, sponsorBrands: ["aurora"], publishedAt: new Date("2026-07-01") }),
      v({ id: "d" }),
    ];
    const stats = computeCommercialStats(videos);
    expect(stats.sponsoredVideoCount).toBe(3);
    expect(stats.sponsorshipFrequency).toBe(0.75);
    expect(stats.distinctSponsorCount).toBe(2);
    expect(stats.repeatSponsorCount).toBe(1); // nimbus twice
    expect(stats.lastSponsorshipAt).toEqual(new Date("2026-07-20"));
  });

  it("returns unknown frequency when there are no long-form videos", () => {
    expect(computeCommercialStats([]).sponsorshipFrequency).toBeNull();
  });
});

describe("computeViewsPerSubscriber", () => {
  it("flags an inflated subscriber base with a low ratio", () => {
    expect(computeViewsPerSubscriber(2_000, 500_000)).toBeCloseTo(0.004);
  });

  it("returns unknown when either input is missing", () => {
    expect(computeViewsPerSubscriber(null, 1000)).toBeNull();
    expect(computeViewsPerSubscriber(1000, null)).toBeNull();
    expect(computeViewsPerSubscriber(1000, 0)).toBeNull();
  });
});
