import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function geminiTextResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GeminiVideoAnalysisProvider (mocked Gemini API responses)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_VIDEO_MODEL = "gemini-test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("parses a valid JSON chunk-analysis response", async () => {
    const validPayload = {
      recognised: true,
      brandName: "Acme",
      brandDomain: "acme.com",
      placementType: "SPONSORED_INTEGRATION",
      sponsorshipConfirmed: true,
      confidenceScore: 0.95,
      startTimestampSeconds: 10,
      endTimestampSeconds: 40,
      evidence: [{ source: "VIDEO_AUDIO", timestampSeconds: 10, text: "Sponsored by Acme.", strength: 0.9 }],
      reason: "Explicit statement.",
    };
    const fetchMock = vi.fn().mockResolvedValue(geminiTextResponse(JSON.stringify(validPayload)));
    vi.stubGlobal("fetch", fetchMock);

    const { GeminiVideoAnalysisProvider } = await import("@/lib/video-analysis/providers/gemini");
    const provider = new GeminiVideoAnalysisProvider();

    const result = await provider.analyseChunk(
      { videoId: "v1", startSeconds: 0, endSeconds: 60, mediaReference: "" },
      { title: "t", description: "d", transcriptSegments: [], previousObservations: [], candidateBrands: [] },
    );

    expect(result.brandName).toBe("Acme");
    expect(result.confidenceScore).toBe(0.95);
  });

  it("strips markdown fences and prose around the JSON payload", async () => {
    const validPayload = {
      recognised: false,
      brandName: null,
      brandDomain: null,
      placementType: null,
      sponsorshipConfirmed: false,
      confidenceScore: 0,
      startTimestampSeconds: null,
      endTimestampSeconds: null,
      evidence: [],
      reason: "Nothing found.",
    };
    const fenced = `Here is the result:\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiTextResponse(fenced)));

    const { GeminiVideoAnalysisProvider } = await import("@/lib/video-analysis/providers/gemini");
    const provider = new GeminiVideoAnalysisProvider();
    const result = await provider.analyseChunk(
      { videoId: "v1", startSeconds: 0, endSeconds: 60, mediaReference: "" },
      { title: "t", description: "d", transcriptSegments: [], previousObservations: [], candidateBrands: [] },
    );

    expect(result.recognised).toBe(false);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    const validPayload = {
      recognised: false,
      brandName: null,
      brandDomain: null,
      placementType: null,
      sponsorshipConfirmed: false,
      confidenceScore: 0,
      startTimestampSeconds: null,
      endTimestampSeconds: null,
      evidence: [],
      reason: "ok",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiTextResponse("this is not valid json at all"))
      .mockResolvedValueOnce(geminiTextResponse(JSON.stringify(validPayload)));
    vi.stubGlobal("fetch", fetchMock);

    const { GeminiVideoAnalysisProvider } = await import("@/lib/video-analysis/providers/gemini");
    const provider = new GeminiVideoAnalysisProvider();
    const result = await provider.analyseChunk(
      { videoId: "v1", startSeconds: 0, endSeconds: 60, mediaReference: "" },
      { title: "t", description: "d", transcriptSegments: [], previousObservations: [], candidateBrands: [] },
    );

    expect(result.reason).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caps audio/visual evidence strength when no authorised media reference is available", async () => {
    const payload = {
      recognised: true,
      brandName: "Acme",
      brandDomain: "acme.com",
      placementType: "SPONSORED_INTEGRATION",
      sponsorshipConfirmed: true,
      confidenceScore: 0.9,
      startTimestampSeconds: 10,
      endTimestampSeconds: 40,
      evidence: [
        { source: "VIDEO_AUDIO", timestampSeconds: 10, text: "Sponsored by Acme.", strength: 0.95 },
        { source: "DESCRIPTION", timestampSeconds: null, text: "acme.com", strength: 0.8 },
      ],
      reason: "x",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiTextResponse(JSON.stringify(payload))));

    const { GeminiVideoAnalysisProvider } = await import("@/lib/video-analysis/providers/gemini");
    const provider = new GeminiVideoAnalysisProvider();
    const result = await provider.analyseChunk(
      { videoId: "v1", startSeconds: 0, endSeconds: 60, mediaReference: "" },
      { title: "t", description: "d", transcriptSegments: [], previousObservations: [], candidateBrands: [] },
    );

    const audioEvidence = result.evidence.find((e) => e.source === "VIDEO_AUDIO");
    expect(audioEvidence?.strength).toBeLessThanOrEqual(0.3);
    const descriptionEvidence = result.evidence.find((e) => e.source === "DESCRIPTION");
    expect(descriptionEvidence?.strength).toBe(0.8);
  });
});
