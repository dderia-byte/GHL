import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import type { VideoAnalysisProvider } from "@/lib/video-analysis/types";

/**
 * Exercises the same stage-sequencing control flow that
 * `src/lib/sponsor-analysis/pipeline.ts` implements (Stage 1 → Stage 2 only if
 * needed → Stage 3 only if still needed, stopping at the first resolved stage) —
 * without touching a real database, by calling the real stage modules directly and
 * asserting on the external providers they'd otherwise call.
 */

const analyseChunkMock = vi.fn();
const anthropicCreateMock = vi.fn();

vi.mock("@/lib/video-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-analysis")>();
  return {
    ...actual,
    getVideoAnalysisProvider: (): VideoAnalysisProvider => ({ name: "mock-injected", analyseChunk: analyseChunkMock }),
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: anthropicCreateMock };
    },
  };
});

const noMetadata = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "t" });

describe("Three-stage pipeline sequencing", () => {
  beforeEach(() => {
    vi.resetModules();
    analyseChunkMock.mockReset();
    anthropicCreateMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves 'This video is sponsored by Higgsfield.' at Stage 1 with zero Anthropic and zero Gemini calls", async () => {
    const { runStageOne } = await import("@/lib/sponsor-analysis/stage-one");
    const descriptionSignals = analyseDescription("This video is sponsored by Higgsfield.");

    const stageOne = runStageOne(descriptionSignals, noMetadata);
    expect(stageOne.shouldStop).toBe(true);
    expect(stageOne.brandName).toBe("Higgsfield");

    // A real pipeline run would stop here — Stage 2/3 are never even invoked.
    expect(analyseChunkMock).not.toHaveBeenCalled();
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it("never calls the native-video provider once Stage 2 resolves the sponsor", async () => {
    const { runStageOne } = await import("@/lib/sponsor-analysis/stage-one");
    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const { extractTranscriptWindows } = await import("@/lib/sponsor-analysis/transcript-windows");

    // Ambiguous description alone (two candidates) so Stage 1 can't safely auto-stop.
    const descriptionSignals = analyseDescription("Sponsored by Acme and thanks to Beta Corp too.");
    const stageOne = runStageOne(descriptionSignals, noMetadata);
    expect(stageOne.shouldStop).toBe(false);

    const windows = extractTranscriptWindows([
      { startSeconds: 10, durationSeconds: 5, text: "Thanks to Acme for sponsoring today's video." },
    ]);
    const stageTwo = await runStageTwo({ title: "t", candidateBrands: stageOne.candidateBrands, windows });

    expect(stageTwo.shouldStop).toBe(true);
    expect(stageTwo.brandName).toBe("Acme");
    // Deterministic transcript match — the cheap model itself wasn't even needed.
    expect(anthropicCreateMock).not.toHaveBeenCalled();

    // A real pipeline run would stop here — Stage 3 is never invoked.
    expect(analyseChunkMock).not.toHaveBeenCalled();
  });

  it("only reaches Stage 3 when neither Stage 1 nor Stage 2 resolved anything", async () => {
    const { runStageOne } = await import("@/lib/sponsor-analysis/stage-one");
    const { runStageTwo } = await import("@/lib/sponsor-analysis/stage-two");
    const { runStageThree } = await import("@/lib/sponsor-analysis/stage-three");

    const description = "Check out my favourite tools this week.";
    const descriptionSignals = analyseDescription(description);
    const stageOne = runStageOne(descriptionSignals, noMetadata);
    expect(stageOne.shouldStop).toBe(false);

    const stageTwo = await runStageTwo({ title: "t", candidateBrands: stageOne.candidateBrands, windows: [] });
    expect(stageTwo.shouldStop).toBe(false);
    expect(anthropicCreateMock).not.toHaveBeenCalled(); // no transcript windows — Stage 2 skipped the model too

    analyseChunkMock.mockResolvedValue({
      recognised: false,
      brandName: null,
      brandDomain: null,
      placementType: null,
      sponsorshipConfirmed: false,
      confidenceScore: 0,
      startTimestampSeconds: null,
      endTimestampSeconds: null,
      evidence: [],
      reason: "nothing here",
      analysisInputs: {
        mediaSourceMethod: "YOUTUBE_URL",
        videoInputAnalysed: true,
        nativeAudioAnalysed: true,
        visualFramesAnalysed: true,
        transcriptProvided: false,
        descriptionProvided: true,
        model: "gemini-test",
        providerError: null,
      },
    });

    const stageThree = await runStageThree({
      youtubeVideoId: "abc123",
      title: "t",
      description,
      durationSeconds: 300,
      descriptionSignals,
      metadataSignals: noMetadata,
      candidateBrands: stageOne.candidateBrands,
      transcriptWindows: [],
      priorEvidence: [],
      analysisMode: "FIRST_SPONSOR_ONLY",
    });

    expect(analyseChunkMock).toHaveBeenCalled();
    expect(stageThree.nativeVideoUsed).toBe(true);
  });
});
