import type { TranscriptSegmentInput } from "../transcript/types";
import { SPONSOR_DISCLOSURE_PHRASES } from "./phrases";

export interface TranscriptSignalMatch {
  phrase: string;
  timestampSeconds: number | null;
  text: string;
}

/**
 * Deterministically scans transcript segments for commercial/sponsorship phrases.
 * Used to flag which chunks likely need targeted, higher-frequency frame analysis,
 * and to seed candidate evidence before the AI model runs.
 */
export function analyseTranscriptSignals(segments: TranscriptSegmentInput[]): TranscriptSignalMatch[] {
  const matches: TranscriptSignalMatch[] = [];
  for (const segment of segments) {
    const lower = segment.text.toLowerCase();
    for (const phrase of SPONSOR_DISCLOSURE_PHRASES) {
      if (lower.includes(phrase)) {
        matches.push({ phrase, timestampSeconds: segment.startSeconds, text: segment.text });
      }
    }
  }
  return matches;
}

/** True when any transcript signal falls within [startSeconds, endSeconds]. */
export function chunkHasTranscriptSignal(
  matches: TranscriptSignalMatch[],
  startSeconds: number,
  endSeconds: number,
): boolean {
  return matches.some(
    (m) => m.timestampSeconds !== null && m.timestampSeconds >= startSeconds && m.timestampSeconds <= endSeconds,
  );
}
