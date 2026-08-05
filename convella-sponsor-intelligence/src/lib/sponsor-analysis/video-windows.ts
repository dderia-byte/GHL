import { getEnv } from "@/lib/env";
import type { ChapterTimestamp } from "@/lib/signals/description";
import type { VideoAnalysisWindow } from "./types";
import type { TranscriptWindow } from "./transcript-windows";

const SPONSOR_CHAPTER_PATTERN = /sponsor|ad break|promo|partner/i;

/**
 * Builds a small, priority-ordered set of targeted video windows to send to Gemini,
 * rather than analysing the full video. Priority: a description chapter timestamp that
 * names a sponsor > a transcript keyword-match timestamp > the first 180 seconds
 * (where most sponsor reads happen) > evenly-spaced mid-roll windows > sequential
 * fallback, only as a last, capped resort. Capped to MAX_VIDEO_WINDOWS.
 */
export function buildVideoAnalysisWindows(params: {
  durationSeconds: number;
  chapterTimestamps: ChapterTimestamp[];
  transcriptWindows: TranscriptWindow[];
  candidateBrandNames: string[];
}): VideoAnalysisWindow[] {
  const env = getEnv();
  const { durationSeconds, chapterTimestamps, transcriptWindows, candidateBrandNames } = params;
  const windowSeconds = env.VIDEO_WINDOW_SECONDS;
  const windows: VideoAnalysisWindow[] = [];

  const clampEnd = (start: number, span: number) => Math.min(durationSeconds, start + span);

  // 1. Description chapter timestamps mentioning a sponsor.
  for (const chapter of chapterTimestamps) {
    if (!SPONSOR_CHAPTER_PATTERN.test(chapter.label)) continue;
    windows.push({
      startSeconds: chapter.seconds,
      endSeconds: clampEnd(chapter.seconds, windowSeconds),
      reason: `Description chapter "${chapter.label}" suggests a sponsor segment here.`,
      candidateBrands: candidateBrandNames,
      priority: 1,
    });
  }

  // 2. Transcript sponsor-keyword timestamps (already narrow windows from Stage 2).
  for (const tw of transcriptWindows) {
    windows.push({
      startSeconds: tw.startSeconds,
      endSeconds: Math.min(durationSeconds, tw.endSeconds),
      reason: `Transcript keyword match (${tw.matchedKeywords.join(", ")}) suggests a sponsor segment here.`,
      candidateBrands: candidateBrandNames,
      priority: 2,
    });
  }

  // 3. First 180 seconds — most sponsor reads happen early in a video.
  if (durationSeconds > 0) {
    windows.push({
      startSeconds: 0,
      endSeconds: clampEnd(0, 180),
      reason: "Sponsor reads most commonly occur in the opening portion of a video.",
      candidateBrands: candidateBrandNames,
      priority: 3,
    });
  }

  // 4. Evenly-spaced mid-roll windows, if there's meaningfully more video beyond the above.
  if (durationSeconds > 360) {
    const mid = Math.floor(durationSeconds / 2);
    windows.push({
      startSeconds: Math.max(0, mid - Math.floor(windowSeconds / 2)),
      endSeconds: clampEnd(Math.max(0, mid - Math.floor(windowSeconds / 2)), windowSeconds),
      reason: "Mid-roll window — sponsor segments sometimes appear partway through longer videos.",
      candidateBrands: candidateBrandNames,
      priority: 4,
    });
  }

  // Deduplicate/merge windows that substantially overlap, keeping the higher-priority (lower number) one.
  const sorted = [...windows].sort((a, b) => a.priority - b.priority);
  const deduped: VideoAnalysisWindow[] = [];
  for (const w of sorted) {
    const overlapping = deduped.find((existing) => w.startSeconds < existing.endSeconds && w.endSeconds > existing.startSeconds);
    if (!overlapping) deduped.push(w);
  }

  const limited = deduped.slice(0, env.MAX_VIDEO_WINDOWS);

  // 5. Sequential fallback: only if nothing else produced any window at all.
  if (limited.length === 0 && durationSeconds > 0) {
    limited.push({
      startSeconds: 0,
      endSeconds: clampEnd(0, windowSeconds),
      reason: "No chapter, transcript, or heuristic signal available — sequential fallback from the start of the video.",
      candidateBrands: candidateBrandNames,
      priority: 5,
    });
  }

  return limited.sort((a, b) => a.startSeconds - b.startSeconds);
}
