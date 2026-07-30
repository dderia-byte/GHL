import type { TranscriptSegmentInput } from "../types";
import { parseTimecodeToSeconds } from "./timecode";

const CUE_TIME_LINE = /^\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3})/;

/**
 * Parses SRT (SubRip) content into timestamped transcript segments.
 * Tolerant of missing sequence numbers and CRLF line endings.
 */
export function parseSrt(content: string): TranscriptSegmentInput[] {
  const normalised = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalised.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const segments: TranscriptSegmentInput[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    let cursor = 0;

    // Optional numeric index line.
    if (/^\d+$/.test(lines[cursor]?.trim() ?? "")) {
      cursor += 1;
    }

    const timeLine = lines[cursor];
    const match = timeLine?.match(CUE_TIME_LINE);
    if (!match) continue;

    const startSeconds = parseTimecodeToSeconds(match[1]);
    const endSeconds = parseTimecodeToSeconds(match[2]);
    const durationSeconds = startSeconds !== null && endSeconds !== null ? Math.max(0, endSeconds - startSeconds) : null;

    const text = lines
      .slice(cursor + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!text) continue;

    segments.push({ text, startSeconds, durationSeconds });
  }

  return segments;
}
