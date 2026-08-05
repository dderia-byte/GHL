import type { TranscriptSegmentInput } from "../types";
import { parseTimecodeToSeconds } from "./timecode";

const LEADING_TIMESTAMP = /^\[?(\d{1,2}:\d{1,2}(?::\d{1,2})?)\]?\s*[-:–]?\s*(.*)$/;

/**
 * Parses a plain-text transcript. Supports an optional leading timestamp per line,
 * e.g. "[00:12] some text" or "00:12 - some text". Lines without a leading timestamp
 * are stored with a null timestamp rather than a guessed one.
 */
export function parseTxt(content: string): TranscriptSegmentInput[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line): TranscriptSegmentInput => {
    const match = line.match(LEADING_TIMESTAMP);
    if (match) {
      const seconds = parseTimecodeToSeconds(match[1]);
      const text = match[2].trim();
      if (seconds !== null && text) {
        return { text, startSeconds: seconds, durationSeconds: null };
      }
    }
    return { text: line, startSeconds: null, durationSeconds: null };
  });
}
