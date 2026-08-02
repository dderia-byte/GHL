import { describe, expect, it } from "vitest";
import { runStageOne } from "@/lib/sponsor-analysis/stage-one";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";

const noMetadata = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "x" });

describe("Stage 1 — free deterministic description/metadata analysis", () => {
  it("resolves 'This video is sponsored by Higgsfield.' at Stage 1 with zero model calls", () => {
    const signals = analyseDescription("This video is sponsored by Higgsfield.");
    const result = runStageOne(signals, noMetadata);

    expect(result.shouldStop).toBe(true);
    expect(result.brandName).toBe("Higgsfield");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
    expect(result.explicitCommercialSignal).toBe(true);
    expect(result.evidence.every((e) => e.source === "DESCRIPTION")).toBe(true);
  });

  it("resolves any explicit sponsorship disclosure generically, not just the Higgsfield example", () => {
    const signals = analyseDescription("Huge thanks — this video is brought to you by Acme Corp, check them out!");
    const result = runStageOne(signals, noMetadata);

    expect(result.shouldStop).toBe(true);
    expect(result.brandName).toBe("Acme Corp");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
  });

  it("does not stop for a plain product URL with no promotional wording", () => {
    const signals = analyseDescription("Check out the docs at https://example.com/docs for more info.");
    const result = runStageOne(signals, noMetadata);
    expect(result.shouldStop).toBe(false);
  });

  it("does not stop for a brand mentioned in a list without commercial context", () => {
    const signals = analyseDescription("Tools I used: VS Code, Warp, Notion, and Figma.");
    const result = runStageOne(signals, noMetadata);
    expect(result.shouldStop).toBe(false);
  });

  it("does not stop when multiple candidate brands are found (ambiguous)", () => {
    const signals = analyseDescription("Sponsored by Acme and thanks to Beta Corp for the extra support.");
    const result = runStageOne(signals, noMetadata);
    expect(result.shouldStop).toBe(false);
    expect(result.reason).toContain("ambiguous");
  });

  it("does not stop for an affiliate disclosure with no identifiable brand", () => {
    const signals = analyseDescription("Some of the links below are affiliate links, thanks for the support.");
    const result = runStageOne(signals, noMetadata);
    expect(result.shouldStop).toBe(false);
  });

  it("does not stop for a creator's own product framed as their own", () => {
    const signals = analyseDescription("This video is sponsored by MyOwnApp, which I built and created myself.");
    const result = runStageOne(signals, noMetadata);
    expect(result.shouldStop).toBe(false);
    expect(result.creatorOwnedProduct).toBe(true);
  });

  it("makes zero model calls — it is a pure function with no async/network dependency", () => {
    // Structural guarantee: runStageOne is synchronous, so it cannot possibly invoke
    // Anthropic or Gemini (both of which are async network calls).
    const signals = analyseDescription("This video is sponsored by Higgsfield.");
    const result = runStageOne(signals, noMetadata);
    expect(result).not.toBeInstanceOf(Promise);
  });
});
