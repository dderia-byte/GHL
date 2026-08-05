import { describe, expect, it } from "vitest";
import { runStageOne } from "@/lib/sponsor-analysis/stage-one";
import { capWindowsToBudget, type TranscriptWindow } from "@/lib/sponsor-analysis/transcript-windows";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";

function stageOneFor(description: string, title = "Fictional test video") {
  return runStageOne(
    analyseDescription(description),
    analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title }),
  );
}

// --- Stage 1: metadata-only sponsor detection --------------------------------
describe("Stage 1 metadata-only detection", () => {
  it("accepts an explicit sponsor from the description alone, with no transcript or model call", () => {
    const result = stageOneFor("This video is sponsored by Nimbus Notes. Try it at https://nimbusnotes.example.com");
    expect(result.shouldStop).toBe(true);
    expect(result.brandName).toBe("Nimbus Notes");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
  });

  it("resolves for free even when the description lists other brands elsewhere", () => {
    // The realistic case: a gear list plus one disclosed sponsor. Requiring the whole
    // description to name exactly one brand used to push this to a paid stage.
    const result = stageOneFor(
      [
        "Today's video is sponsored by Nimbus Notes — get started at https://nimbusnotes.example.com",
        "",
        "My gear:",
        "Camera: Lumina X200",
        "Mic: Acousta Pro",
      ].join("\n"),
    );
    expect(result.shouldStop).toBe(true);
    expect(result.brandName).toBe("Nimbus Notes");
  });

  it("refuses to auto-stop when the disclosure itself names two brands", () => {
    const result = stageOneFor("This video is sponsored by Nimbus Notes and Aurora VPN.");
    expect(result.shouldStop).toBe(false);
    expect(result.reason).toMatch(/ambiguous/i);
  });

  it("does not auto-stop on weak wording alone", () => {
    const result = stageOneFor("Thanks to Nimbus Notes for the support. Check them out!");
    expect(result.shouldStop).toBe(false);
  });

  it("does not accept the creator's own product as a sponsor", () => {
    const result = stageOneFor("This video is sponsored by DevMastery Pro, the course I built myself.");
    expect(result.shouldStop).toBe(false);
    expect(result.creatorOwnedProduct).toBe(true);
  });

  it("does not accept a bare affiliate/discount description as a sponsorship", () => {
    const result = stageOneFor("Use code SAVE10 for 10% off. Some links below are affiliate links.");
    expect(result.shouldStop).toBe(false);
    expect(result.affiliateOnly).toBe(true);
  });
});

// --- Transcript seconds budget -----------------------------------------------
describe("Transcript budget", () => {
  const window = (startSeconds: number, endSeconds: number, priority = 1): TranscriptWindow => ({
    startSeconds,
    endSeconds,
    text: `window ${startSeconds}-${endSeconds}`,
    matchedKeywords: ["sponsor"],
    priority,
  });

  it("keeps the opening read first — that is where sponsor reads live", () => {
    const kept = capWindowsToBudget([window(600, 630, 5), window(10, 40)], 60);
    expect(kept.map((w) => w.startSeconds)).toContain(10);
  });

  it("never exceeds the seconds budget", () => {
    const kept = capWindowsToBudget([window(0, 60), window(100, 160), window(200, 260)], 120);
    const total = kept.reduce((sum, w) => sum + (w.endSeconds - w.startSeconds), 0);
    expect(total).toBeLessThanOrEqual(120);
  });

  it("returns nothing when the budget is zero", () => {
    expect(capWindowsToBudget([window(0, 30)], 0)).toEqual([]);
  });

  it("returns windows in chronological order", () => {
    const kept = capWindowsToBudget([window(300, 320, 9), window(10, 30, 1), window(100, 120, 5)], 120);
    const starts = kept.map((w) => w.startSeconds);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("drops a single window that is larger than the whole budget rather than truncating it", () => {
    expect(capWindowsToBudget([window(0, 600)], 120)).toEqual([]);
  });
});
