/**
 * Pure creator performance mathematics. No database, no network — every function
 * here takes plain video records and returns computed statistics, so the logic that
 * drives recommendations is directly unit-testable.
 *
 * Two rules run through all of it:
 *  1. Shorts are NEVER mixed into long-form performance. Sponsorship expectations are
 *     set by long-form views; a channel whose Shorts pull 400k while its long-form
 *     pulls 3k is a 3k creator for sponsorship purposes.
 *  2. Anything that cannot be computed from real data returns null ("unknown") rather
 *     than a guess or a zero — nulls are reported as unknown and reduce confidence,
 *     zeros would silently read as "measured and bad".
 */

/** YouTube's current maximum Short length. Anything at or under this is treated as a Short. */
export const SHORTS_MAX_DURATION_SECONDS = 180;

export interface ProfileVideoInput {
  id: string;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount?: number | null;
  publishedAt: Date | null;
  /** Whether a counted sponsorship was detected on this video. */
  hasSponsorship: boolean;
  /** Canonical brand names detected on this video (for repeat-sponsor maths). */
  sponsorBrands: string[];
}

export interface FormatSplit {
  longForm: ProfileVideoInput[];
  shorts: ProfileVideoInput[];
  /** Null when no video has a known duration — unknown, not zero. */
  shortsRatio: number | null;
}

/**
 * Splits uploads by format. Videos with an unknown duration are excluded from BOTH
 * buckets: guessing their format would corrupt the long-form averages that drive
 * every downstream recommendation.
 */
export function splitByFormat(
  videos: ProfileVideoInput[],
  shortsMaxSeconds: number = SHORTS_MAX_DURATION_SECONDS,
): FormatSplit {
  const known = videos.filter((v) => v.durationSeconds !== null && v.durationSeconds > 0);
  const shorts = known.filter((v) => (v.durationSeconds as number) <= shortsMaxSeconds);
  const longForm = known.filter((v) => (v.durationSeconds as number) > shortsMaxSeconds);
  return {
    longForm,
    shorts,
    shortsRatio: known.length > 0 ? shorts.length / known.length : null,
  };
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Median resists the single-viral-video skew that makes means misleading. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Newest-first ordering; videos with no publish date sort last (unknown recency). */
export function sortNewestFirst(videos: ProfileVideoInput[]): ProfileVideoInput[] {
  return [...videos].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}

export interface ViewStats {
  avgViewsLast10: number | null;
  avgViewsLast25: number | null;
  medianViewsLast25: number | null;
  highestRecentViews: number | null;
  lowestRecentViews: number | null;
}

export function computeViewStats(longFormNewestFirst: ProfileVideoInput[]): ViewStats {
  const viewsOf = (list: ProfileVideoInput[]) =>
    list.map((v) => v.viewCount).filter((v): v is number => v !== null && v >= 0);

  const last10 = viewsOf(longFormNewestFirst.slice(0, 10));
  const last25 = viewsOf(longFormNewestFirst.slice(0, 25));

  return {
    avgViewsLast10: mean(last10),
    avgViewsLast25: mean(last25),
    medianViewsLast25: median(last25),
    highestRecentViews: last25.length ? Math.max(...last25) : null,
    lowestRecentViews: last25.length ? Math.min(...last25) : null,
  };
}

export interface EngagementStats {
  avgLikes: number | null;
  avgComments: number | null;
  engagementRate: number | null;
}

/**
 * Engagement across long-form uploads. Rate is (likes + comments) ÷ views, computed
 * only over videos that actually report both a view count and at least one
 * interaction metric — creators who hide likes must not read as zero-engagement.
 */
export function computeEngagement(longForm: ProfileVideoInput[]): EngagementStats {
  const likes = longForm.map((v) => v.likeCount).filter((v): v is number => v !== null);
  const comments = longForm.map((v) => v.commentCount ?? null).filter((v): v is number => v !== null);

  const rateable = longForm.filter(
    (v) => v.viewCount !== null && v.viewCount > 0 && (v.likeCount !== null || (v.commentCount ?? null) !== null),
  );
  const rates = rateable.map((v) => ((v.likeCount ?? 0) + (v.commentCount ?? 0)) / (v.viewCount as number));

  return {
    avgLikes: mean(likes),
    avgComments: mean(comments),
    engagementRate: mean(rates),
  };
}

export interface CadenceStats {
  uploadsPerMonth: number | null;
  daysSinceLastUpload: number | null;
  uploadConsistency: number | null;
}

/**
 * Upload cadence over the observed long-form window. `uploadConsistency` is
 * 1 − (stddev ÷ mean) of the gaps between uploads, clamped to 0–1: a creator who
 * posts every 7 days scores ~1, one who posts three videos then vanishes for a year
 * scores near 0.
 */
export function computeCadence(longFormNewestFirst: ProfileVideoInput[], now: Date = new Date()): CadenceStats {
  const dated = longFormNewestFirst
    .map((v) => v.publishedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  if (dated.length === 0) {
    return { uploadsPerMonth: null, daysSinceLastUpload: null, uploadConsistency: null };
  }

  const daysSinceLastUpload = Math.max(0, Math.floor((now.getTime() - dated[0].getTime()) / (24 * 3600 * 1000)));

  if (dated.length < 2) {
    return { uploadsPerMonth: null, daysSinceLastUpload, uploadConsistency: null };
  }

  const spanDays = (dated[0].getTime() - dated[dated.length - 1].getTime()) / (24 * 3600 * 1000);
  const uploadsPerMonth = spanDays > 0 ? (dated.length / spanDays) * 30 : null;

  const gaps: number[] = [];
  for (let i = 0; i < dated.length - 1; i += 1) {
    gaps.push((dated[i].getTime() - dated[i + 1].getTime()) / (24 * 3600 * 1000));
  }
  const gapMean = mean(gaps);
  let uploadConsistency: number | null = null;
  if (gapMean !== null && gapMean > 0) {
    const variance = gaps.reduce((sum, g) => sum + (g - gapMean) ** 2, 0) / gaps.length;
    const cv = Math.sqrt(variance) / gapMean;
    uploadConsistency = Math.max(0, Math.min(1, 1 - cv));
  }

  return { uploadsPerMonth, daysSinceLastUpload, uploadConsistency };
}

/**
 * View trend: median views of the newer half ÷ median of the older half.
 * >1 growing, <1 declining. Needs at least 6 long-form videos with views to be
 * meaningful, otherwise unknown.
 */
export function computeViewTrend(longFormNewestFirst: ProfileVideoInput[]): number | null {
  const withViews = longFormNewestFirst.filter((v) => v.viewCount !== null && v.viewCount >= 0);
  if (withViews.length < 6) return null;

  const half = Math.floor(withViews.length / 2);
  const newer = median(withViews.slice(0, half).map((v) => v.viewCount as number));
  const older = median(withViews.slice(half).map((v) => v.viewCount as number));
  if (newer === null || older === null || older <= 0) return null;
  return newer / older;
}

export interface CommercialStats {
  sponsorshipFrequency: number | null;
  sponsoredVideoCount: number;
  distinctSponsorCount: number;
  repeatSponsorCount: number;
  lastSponsorshipAt: Date | null;
}

/**
 * Commercial activity measured over LONG-FORM videos only — sponsorship frequency
 * computed across a Shorts-heavy upload list would understate a creator who runs
 * integrations in every long-form video.
 */
export function computeCommercialStats(longForm: ProfileVideoInput[]): CommercialStats {
  const sponsored = longForm.filter((v) => v.hasSponsorship);
  const brandCounts = new Map<string, number>();
  for (const video of longForm) {
    for (const brand of new Set(video.sponsorBrands)) {
      brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
    }
  }

  const sponsorshipDates = sponsored
    .map((v) => v.publishedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    sponsorshipFrequency: longForm.length > 0 ? sponsored.length / longForm.length : null,
    sponsoredVideoCount: sponsored.length,
    distinctSponsorCount: brandCounts.size,
    repeatSponsorCount: Array.from(brandCounts.values()).filter((count) => count > 1).length,
    lastSponsorshipAt: sponsorshipDates[0] ?? null,
  };
}

/**
 * Views per subscriber (median long-form ÷ subscribers). A very low ratio flags an
 * inflated or disengaged subscriber base — one of the clearest reasons a human
 * rejects a creator that looks big on paper.
 */
export function computeViewsPerSubscriber(
  medianLongFormViews: number | null,
  subscriberCount: number | null,
): number | null {
  if (medianLongFormViews === null || subscriberCount === null || subscriberCount <= 0) return null;
  return medianLongFormViews / subscriberCount;
}
