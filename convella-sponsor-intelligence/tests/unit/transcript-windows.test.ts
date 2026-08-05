import { describe, expect, it, afterEach, vi } from "vitest";
import { extractTranscriptWindows } from "@/lib/sponsor-analysis/transcript-windows";
import type { TranscriptSegmentInput } from "@/lib/transcript/types";

const ORIGINAL_ENV = { ...process.env };

function segment(startSeconds: number, text: string): TranscriptSegmentInput {
  return { startSeconds, durationSeconds: 5, text };
}

describe("extractTranscriptWindows", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns nothing when no segment matches a sponsor keyword", () => {
    const segments = [segment(0, "Welcome back to the channel."), segment(10, "Today we're building an app.")];
    expect(extractTranscriptWindows(segments)).toEqual([]);
  });

  it("builds a narrow window around a match, never the full transcript", () => {
    const longIntro = Array.from({ length: 50 }, (_, i) => segment(i * 10, `Filler line ${i} about nothing in particular.`));
    const segments = [...longIntro, segment(600, "Huge thanks to Acme for sponsoring today's video.")];

    const windows = extractTranscriptWindows(segments);

    expect(windows.length).toBeGreaterThan(0);
    const totalOriginalChars = segments.reduce((n, s) => n + s.text.length, 0);
    const totalWindowChars = windows.reduce((n, w) => n + w.text.length, 0);
    expect(totalWindowChars).toBeLessThan(totalOriginalChars);
  });

  it("merges overlapping windows instead of duplicating them", () => {
    const segments = [
      segment(100, "Our sponsor for today is Acme."),
      segment(110, "Acme makes it easy to sponsor creators."), // close enough to overlap the first window
    ];
    const windows = extractTranscriptWindows(segments);
    expect(windows.length).toBe(1);
  });

  it("respects MAX_TRANSCRIPT_WINDOWS", async () => {
    vi.resetModules();
    process.env.MAX_TRANSCRIPT_WINDOWS = "2";
    const { extractTranscriptWindows: extract } = await import("@/lib/sponsor-analysis/transcript-windows");
    const segments = [
      segment(0, "Thanks to Acme for sponsoring."),
      segment(2000, "Brought to you by Beta Corp."),
      segment(4000, "This portion is a paid partnership with Gamma Inc."),
      segment(6000, "Use code SAVE10 for a discount."),
    ];
    const windows = extract(segments);
    expect(windows.length).toBeLessThanOrEqual(2);
  });

  it("respects MAX_TRANSCRIPT_MODEL_CHARS", async () => {
    vi.resetModules();
    process.env.MAX_TRANSCRIPT_MODEL_CHARS = "50";
    const { extractTranscriptWindows: extract } = await import("@/lib/sponsor-analysis/transcript-windows");
    const segments = [segment(0, "Thanks to Acme for sponsoring today's incredibly long and detailed video about everything.")];
    const windows = extract(segments);
    const totalChars = windows.reduce((n, w) => n + w.text.length, 0);
    expect(totalChars).toBeLessThanOrEqual(50);
  });

  it("preserves original wording and timestamps rather than paraphrasing", () => {
    const segments = [segment(42, "Sponsored by Acme, use code HELLO42 for ten percent off.")];
    const windows = extractTranscriptWindows(segments);
    expect(windows[0].text).toContain("Sponsored by Acme, use code HELLO42 for ten percent off.");
    expect(windows[0].text).toContain("[42s]");
  });

  it("ignores segments with a null timestamp", () => {
    const segments: TranscriptSegmentInput[] = [{ startSeconds: null, durationSeconds: null, text: "Sponsored by Acme." }];
    expect(extractTranscriptWindows(segments)).toEqual([]);
  });
});
