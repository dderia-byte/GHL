import { getEnv } from "@/lib/env";
import type { TranscriptSegmentInput } from "@/lib/transcript/types";

export interface TranscriptWindow {
  startSeconds: number;
  endSeconds: number;
  text: string;
  matchedKeywords: string[];
  priority: number;
}

const STRONG_KEYWORDS = [
  "sponsored",
  "sponsor",
  "sponsorship",
  "brought to you by",
  "paid promotion",
  "paid partnership",
  "today's video",
];

const KEYWORDS = [
  ...STRONG_KEYWORDS,
  "thanks to",
  "thank you to",
  "partner",
  "partnership",
  "affiliate",
  "use code",
  "discount",
  "link below",
  "free trial",
  "special offer",
  "quick word from",
  "before we continue",
  "this portion",
  "supported by",
  "use my link",
  "check out",
  "our friends at",
  "sponsor segment",
];

const TRY_BRAND_PATTERN = /\btry\s+[A-Z][\w.-]*/i;
const PERCENT_OFF_PATTERN = /\bget\s+\d{1,3}%?\s*off\b/i;

function findKeywordMatches(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = KEYWORDS.filter((k) => lower.includes(k));
  if (TRY_BRAND_PATTERN.test(text)) matches.push("try [brand]");
  if (PERCENT_OFF_PATTERN.test(text)) matches.push("get [%] off");
  return matches;
}

/**
 * Deterministically scans transcript segments for sponsor-related keywords (never
 * calls a model) and builds narrow, timestamped windows around each match — never the
 * full transcript. Overlapping windows are merged, duplicate text is dropped, windows
 * are ranked by keyword strength, and the result is capped to
 * MAX_TRANSCRIPT_WINDOWS / MAX_TRANSCRIPT_MODEL_CHARS so Stage 2 never sends more than
 * a small, targeted slice of the transcript to any model.
 */
export function extractTranscriptWindows(segments: TranscriptSegmentInput[]): TranscriptWindow[] {
  const env = getEnv();
  const timed = segments.filter((s): s is TranscriptSegmentInput & { startSeconds: number } => s.startSeconds !== null);
  if (timed.length === 0) return [];

  type RawWindow = { start: number; end: number; matchedKeywords: string[] };
  const raw: RawWindow[] = [];

  for (const segment of timed) {
    const matches = findKeywordMatches(segment.text);
    if (matches.length === 0) continue;
    const segmentEnd = segment.startSeconds + (segment.durationSeconds ?? 0);
    raw.push({
      start: Math.max(0, segment.startSeconds - env.TRANSCRIPT_CONTEXT_BEFORE_SECONDS),
      end: segmentEnd + env.TRANSCRIPT_CONTEXT_AFTER_SECONDS,
      matchedKeywords: matches,
    });
  }

  if (raw.length === 0) return [];

  raw.sort((a, b) => a.start - b.start);
  const merged: RawWindow[] = [];
  for (const w of raw) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
      last.matchedKeywords = Array.from(new Set([...last.matchedKeywords, ...w.matchedKeywords]));
    } else {
      merged.push({ ...w });
    }
  }

  const seenText = new Set<string>();
  const windows: TranscriptWindow[] = [];
  for (const w of merged) {
    const windowSegments = timed.filter((s) => s.startSeconds >= w.start && s.startSeconds <= w.end);
    const text = windowSegments.map((s) => `[${s.startSeconds}s] ${s.text}`).join("\n").trim();
    if (!text || seenText.has(text)) continue;
    seenText.add(text);

    const strongHits = w.matchedKeywords.filter((k) => STRONG_KEYWORDS.includes(k)).length;
    const priority = strongHits * 10 + w.matchedKeywords.length;

    windows.push({ startSeconds: w.start, endSeconds: w.end, text, matchedKeywords: w.matchedKeywords, priority });
  }

  windows.sort((a, b) => b.priority - a.priority);

  const limited = windows.slice(0, env.MAX_TRANSCRIPT_WINDOWS);
  let totalChars = 0;
  const bounded: TranscriptWindow[] = [];
  for (const w of limited) {
    if (totalChars + w.text.length > env.MAX_TRANSCRIPT_MODEL_CHARS) break;
    totalChars += w.text.length;
    bounded.push(w);
  }

  // Re-sort chronologically for readability once the priority-based selection is done.
  return bounded.sort((a, b) => a.startSeconds - b.startSeconds);
}
