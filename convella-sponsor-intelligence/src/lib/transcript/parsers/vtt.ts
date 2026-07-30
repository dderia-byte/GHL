import type { TranscriptSegmentInput } from "../types";
import { parseTimecodeToSeconds } from "./timecode";

const CUE_TIME_LINE = /(\d{1,2}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?[.,]\d{1,3})/;

/**
 * Parses WebVTT content into timestamped transcript segments.
 * Ignores WEBVTT header, NOTE blocks, STYLE blocks and cue identifiers.
 */
export function parseVtt(content: string): TranscriptSegmentInput[] {
  const normalised = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalised.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const segments: TranscriptSegmentInput[] = [];

  for (const block of blocks) {
    if (/^WEBVTT/i.test(block) || /^NOTE/i.test(block) || /^STYLE/i.test(block)) continue;

    const lines = block.split("\n");
    const timeLineIndex = lines.findIndex((line) => CUE_TIME_LINE.test(line));
    if (timeLineIndex === -1) continue;

    const match = lines[timeLineIndex].match(CUE_TIME_LINE);
    if (!match) continue;

    const startSeconds = parseTimecodeToSeconds(match[1]);
    const endSeconds = parseTimecodeToSeconds(match[2]);
    const durationSeconds = startSeconds !== null && endSeconds !== null ? Math.max(0, endSeconds - startSeconds) : null;

    const text = lines
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!text) continue;

    segments.push({ text, startSeconds, durationSeconds });
  }

  return segments;
}
