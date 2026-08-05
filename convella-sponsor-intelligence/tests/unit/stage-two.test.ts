import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptWindow } from "@/lib/sponsor-analysis/transcript-windows";

const ORIGINAL_ENV = { ...process.env };
const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

function window(startSeconds: number, text: string, matchedKeywords: string[] = ["sponsored"]): TranscriptWindow {
  return { startSeconds, endSeconds: startSeconds + 60, text, matchedKeywords, priority: 10 };
}

describe("Stage 2 — targeted transcript analysis", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves an explicit spoken sponsorship statement without any model call", async () => {
    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const windows = [window(42, "[42s] Thanks to Higgsfield for sponsoring today's video.")];

    const result = await runStageTwo({ title: "t", candidateBrands: [{ name: "Higgsfield", domain: null }], windows });

    expect(result.shouldStop).toBe(true);
    expect(result.brandName).toBe("Higgsfield");
    expect(result.modelUsed).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("does not run native video analysis to resolve — it only uses transcript text", async () => {
    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const windows = [window(42, "[42s] Thanks to Higgsfield for sponsoring today's video.")];
    const result = await runStageTwo({ title: "t", candidateBrands: [{ name: "Higgsfield", domain: null }], windows });
    expect(result.evidence.every((e) => e.source === "TRANSCRIPT")).toBe(true);
  });

  it("is 'not needed' (no model call) when no transcript windows matched anything", async () => {
    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const result = await runStageTwo({ title: "t", candidateBrands: [], windows: [] });
    expect(result.shouldStop).toBe(false);
    expect(result.modelUsed).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("falls back to the cheap text model when wording is ambiguous, and never sends the full transcript", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recognised: true,
            brandName: "Acme",
            brandDomain: "acme.com",
            placementType: "SPONSORED_INTEGRATION",
            sponsorshipConfirmed: true,
            confidenceScore: 0.95,
            startTimestampSeconds: 42,
            endTimestampSeconds: 60,
            evidence: [{ source: "TRANSCRIPT", timestampSeconds: 42, text: "We're excited about Acme today.", strength: 0.9 }],
            reason: "Ambiguous wording resolved by the model.",
          }),
        },
      ],
      usage: { input_tokens: 500, output_tokens: 80 },
    });

    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const windows = [window(42, "[42s] We're excited about Acme today, check them out.", ["check out"])];
    const result = await runStageTwo({ title: "t", candidateBrands: [{ name: "Acme", domain: "acme.com" }], windows });

    expect(result.modelUsed).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    const promptSent = createMock.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("FULL TRANSCRIPT");
    expect(promptSent.length).toBeLessThan(5000);
    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(80);
  });

  it("does not stop when the cheap model itself is unsure (confidence below 0.92)", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recognised: false,
            brandName: null,
            brandDomain: null,
            placementType: null,
            sponsorshipConfirmed: false,
            confidenceScore: 0.4,
            startTimestampSeconds: null,
            endTimestampSeconds: null,
            evidence: [],
            reason: "Could not determine with confidence.",
          }),
        },
      ],
      usage: { input_tokens: 300, output_tokens: 40 },
    });

    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const windows = [window(42, "[42s] Acme was mentioned in passing.", ["check out"])];
    const result = await runStageTwo({ title: "t", candidateBrands: [{ name: "Acme", domain: null }], windows });

    expect(result.shouldStop).toBe(false);
  });
});
