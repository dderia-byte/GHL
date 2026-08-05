import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import type { SponsorRecognitionResult, VideoAnalysisProvider } from "@/lib/video-analysis/types";

const ORIGINAL_ENV = { ...process.env };
const analyseChunk = vi.fn();

vi.mock("@/lib/video-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-analysis")>();
  return {
    ...actual,
    getVideoAnalysisProvider: (): VideoAnalysisProvider => ({ name: "mock-injected", analyseChunk }),
  };
});

const STRONG_CONFIRMATION: SponsorRecognitionResult = {
  recognised: true,
  brandName: "Acme",
  brandDomain: "acme.com",
  placementType: "SPONSORED_INTEGRATION",
  sponsorshipConfirmed: true,
  confidenceScore: 0.95,
  startTimestampSeconds: 30,
  endTimestampSeconds: 45,
  evidence: [
    { source: "VIDEO_AUDIO", timestampSeconds: 30, text: "Thanks to Acme for sponsoring this video.", strength: 1 },
    { source: "VIDEO_VISUAL", timestampSeconds: 32, text: "Acme paid promotion sponsor card shown on screen.", strength: 1 },
  ],
  reason: "Explicit spoken statement plus on-screen disclosure.",
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
};

const NOTHING_FOUND: SponsorRecognitionResult = {
  recognised: false,
  brandName: null,
  brandDomain: null,
  placementType: null,
  sponsorshipConfirmed: false,
  confidenceScore: 0,
  startTimestampSeconds: null,
  endTimestampSeconds: null,
  evidence: [],
  reason: "Nothing found in this window.",
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
};

describe("Stage 3 — targeted native video analysis", () => {
  beforeEach(() => {
    vi.resetModules();
    analyseChunk.mockReset();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("stops immediately on the first confirmed window and does not analyse further windows", async () => {
    analyseChunk.mockResolvedValueOnce(STRONG_CONFIRMATION).mockResolvedValueOnce(STRONG_CONFIRMATION);
    const { runStageThree } = await import("@/lib/sponsor-analysis/stage-three");

    const descriptionSignals = analyseDescription("This video is sponsored by Acme. https://acme.com");
    const metadataSignals = analyseYouTubeMetadata({ paidProductPlacement: true, tags: [], title: "t" });

    const result = await runStageThree({
      youtubeVideoId: "abc123",
      title: "t",
      description: "This video is sponsored by Acme. https://acme.com",
      durationSeconds: 900,
      descriptionSignals,
      metadataSignals,
      candidateBrands: [{ name: "Acme", domain: "acme.com" }],
      transcriptWindows: [],
      priorEvidence: [],
      analysisMode: "FIRST_SPONSOR_ONLY",
    });

    expect(result.shouldStop).toBe(true);
    expect(result.callsMade).toBe(1);
    expect(analyseChunk).toHaveBeenCalledTimes(1);
    expect(result.nativeAudioUsed).toBe(true);
    expect(result.visualAnalysisUsed).toBe(true);
  });

  it("never claims native video/audio was used when the provider reports it wasn't", async () => {
    analyseChunk.mockResolvedValue({
      ...NOTHING_FOUND,
      analysisInputs: { ...NOTHING_FOUND.analysisInputs, videoInputAnalysed: false, nativeAudioAnalysed: false, visualFramesAnalysed: false },
    });
    const { runStageThree } = await import("@/lib/sponsor-analysis/stage-three");
    const descriptionSignals = analyseDescription("no sponsor here");
    const metadataSignals = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "t" });

    const result = await runStageThree({
      youtubeVideoId: "abc123",
      title: "t",
      description: "no sponsor here",
      durationSeconds: 300,
      descriptionSignals,
      metadataSignals,
      candidateBrands: [],
      transcriptWindows: [],
      priorEvidence: [],
      analysisMode: "FIRST_SPONSOR_ONLY",
    });

    expect(result.nativeVideoUsed).toBe(false);
    expect(result.nativeAudioUsed).toBe(false);
    expect(result.visualAnalysisUsed).toBe(false);
  });

  it("stops making calls once the cost/call-count limit is reached, and reports costLimitReached", async () => {
    process.env.MAX_NATIVE_VIDEO_CALLS_PER_VIDEO = "1";
    process.env.MAX_VIDEO_WINDOWS = "3";
    analyseChunk.mockResolvedValue(NOTHING_FOUND);
    const { runStageThree } = await import("@/lib/sponsor-analysis/stage-three");

    const descriptionSignals = analyseDescription("no sponsor here");
    const metadataSignals = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "t" });

    const result = await runStageThree({
      youtubeVideoId: "abc123",
      title: "t",
      description: "no sponsor here",
      durationSeconds: 3000,
      descriptionSignals,
      metadataSignals,
      candidateBrands: [],
      transcriptWindows: [
        { startSeconds: 500, endSeconds: 560, text: "x", matchedKeywords: ["sponsor"], priority: 1 },
        { startSeconds: 1500, endSeconds: 1560, text: "y", matchedKeywords: ["sponsor"], priority: 1 },
      ],
      priorEvidence: [],
      analysisMode: "FIRST_SPONSOR_ONLY",
    });

    expect(result.costLimitReached).toBe(true);
    expect(analyseChunk).toHaveBeenCalledTimes(1);
    expect(result.shouldStop).toBe(false);
  });

  it("makes no calls at all when the video's duration is unknown", async () => {
    const { runStageThree } = await import("@/lib/sponsor-analysis/stage-three");
    const descriptionSignals = analyseDescription("");
    const metadataSignals = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "t" });

    const result = await runStageThree({
      youtubeVideoId: "abc123",
      title: "t",
      description: "",
      durationSeconds: 0,
      descriptionSignals,
      metadataSignals,
      candidateBrands: [],
      transcriptWindows: [],
      priorEvidence: [],
      analysisMode: "FIRST_SPONSOR_ONLY",
    });

    expect(result.callsMade).toBe(0);
    expect(analyseChunk).not.toHaveBeenCalled();
  });
});
