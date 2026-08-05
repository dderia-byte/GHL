/**
 * Which videos may be analysed for sponsorship. Pure and unit-tested: eligibility
 * decides what the run spends money on, so it must be inspectable rather than
 * scattered through the pipeline.
 *
 * Excluded, per the qualification rules:
 *  - YouTube Shorts and anything under three minutes (sponsor reads don't fit, and
 *    Shorts performance says nothing about long-form sponsorship value)
 *  - Livestream replays (hours of unstructured content; a sponsor read inside one is
 *    not a comparable placement, and analysing them is disproportionately expensive)
 *  - Duplicates (same YouTube video id appearing twice in an uploads list)
 */

export const MIN_ELIGIBLE_DURATION_SECONDS = 180;

export interface EligibilityCandidate {
  youtubeVideoId: string;
  durationSeconds: number | null;
  isLivestream: boolean;
  publishedAt: Date | null;
}

export type IneligibleReason = "TOO_SHORT" | "UNKNOWN_DURATION" | "LIVESTREAM" | "DUPLICATE";

export interface EligibilityResult<T extends EligibilityCandidate> {
  eligible: T[];
  rejected: Array<{ video: T; reason: IneligibleReason }>;
}

export function isEligibleLongForm(video: EligibilityCandidate): { eligible: boolean; reason?: IneligibleReason } {
  if (video.isLivestream) return { eligible: false, reason: "LIVESTREAM" };
  // An unknown duration cannot be confirmed to clear the three-minute floor. Analysing
  // it anyway risks paying for a Short, so it is skipped rather than assumed.
  if (video.durationSeconds === null) return { eligible: false, reason: "UNKNOWN_DURATION" };
  if (video.durationSeconds < MIN_ELIGIBLE_DURATION_SECONDS) return { eligible: false, reason: "TOO_SHORT" };
  return { eligible: true };
}

/**
 * Filters an uploads list to eligible long-form videos, newest first, removing
 * duplicates by YouTube video id.
 */
export function selectEligibleVideos<T extends EligibilityCandidate>(videos: T[]): EligibilityResult<T> {
  const eligible: T[] = [];
  const rejected: Array<{ video: T; reason: IneligibleReason }> = [];
  const seen = new Set<string>();

  const newestFirst = [...videos].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  for (const video of newestFirst) {
    if (seen.has(video.youtubeVideoId)) {
      rejected.push({ video, reason: "DUPLICATE" });
      continue;
    }
    seen.add(video.youtubeVideoId);

    const check = isEligibleLongForm(video);
    if (check.eligible) eligible.push(video);
    else rejected.push({ video, reason: check.reason as IneligibleReason });
  }

  return { eligible, rejected };
}
