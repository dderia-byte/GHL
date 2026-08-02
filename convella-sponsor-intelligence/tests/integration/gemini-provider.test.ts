import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiVideoAnalysisProvider } from "@/lib/video-analysis/providers/gemini";
import type { GoogleGenAI } from "@google/genai";
import type { VideoAnalysisContext, VideoChunk } from "@/lib/video-analysis/types";

const BASE_CHUNK: VideoChunk = { videoId: "v1", startSeconds: 0, endSeconds: 60, mediaReference: null };
const BASE_CONTEXT: VideoAnalysisContext = {
  title: "t",
  description: "d",
  transcriptSegments: [],
  previousObservations: [],
  candidateBrands: [],
};

function modalityUsage(modalities: string[]) {
  return { promptTokensDetails: modalities.map((modality) => ({ modality, tokenCount: 100 })) };
}

/** A minimal stand-in for the @google/genai client, injected via the provider's constructor. */
function fakeClient(generateContentImpl: (...args: unknown[]) => unknown) {
  return {
    models: { generateContent: vi.fn(generateContentImpl) },
    files: { upload: vi.fn(), get: vi.fn() },
  } as unknown as GoogleGenAI;
}

function geminiResponse(payload: Record<string, unknown>, modalities: string[]) {
  return { text: JSON.stringify(payload), usageMetadata: modalityUsage(modalities) };
}

const NO_SPONSOR_TEXT_ONLY_PAYLOAD = {
  videoInputAnalysed: false,
  nativeAudioAnalysed: false,
  visualFramesAnalysed: false,
  recognised: false,
  brandName: null,
  brandDomain: null,
  placementType: null,
  sponsorshipConfirmed: false,
  confidenceScore: 0,
  startTimestampSeconds: null,
  endTimestampSeconds: null,
  evidence: [],
  reason: "Nothing found in text only.",
};

function provider(client: GoogleGenAI) {
  return new GeminiVideoAnalysisProvider("test-key", "gemini-test", client);
}

describe("GeminiVideoAnalysisProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses a valid JSON chunk-analysis response", async () => {
    const payload = {
      videoInputAnalysed: false,
      nativeAudioAnalysed: false,
      visualFramesAnalysed: false,
      recognised: true,
      brandName: "Acme",
      brandDomain: "acme.com",
      placementType: "SPONSORED_INTEGRATION",
      sponsorshipConfirmed: true,
      confidenceScore: 0.95,
      startTimestampSeconds: 10,
      endTimestampSeconds: 40,
      evidence: [{ source: "DESCRIPTION", timestampSeconds: null, text: "Sponsored by Acme.", strength: 0.9 }],
      reason: "Explicit statement.",
    };
    const client = fakeClient(() => geminiResponse(payload, ["TEXT"]));

    const result = await provider(client).analyseChunk(BASE_CHUNK, BASE_CONTEXT);

    expect(result.brandName).toBe("Acme");
    expect(result.confidenceScore).toBe(0.95);
  });

  it("strips markdown fences and prose around the JSON payload", async () => {
    const fenced = `Here is the result:\n\`\`\`json\n${JSON.stringify(NO_SPONSOR_TEXT_ONLY_PAYLOAD)}\n\`\`\``;
    const client = fakeClient(() => ({ text: fenced, usageMetadata: modalityUsage(["TEXT"]) }));

    const result = await provider(client).analyseChunk(BASE_CHUNK, BASE_CONTEXT);

    expect(result.recognised).toBe(false);
  });

  it("retries with exponential backoff on malformed JSON and succeeds on the second attempt", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: "this is not valid json at all", usageMetadata: modalityUsage(["TEXT"]) })
      .mockResolvedValueOnce(geminiResponse({ ...NO_SPONSOR_TEXT_ONLY_PAYLOAD, reason: "ok" }, ["TEXT"]));
    const client = { models: { generateContent }, files: { upload: vi.fn(), get: vi.fn() } } as unknown as GoogleGenAI;

    const resultPromise = provider(client).analyseChunk(BASE_CHUNK, BASE_CONTEXT);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.reason).toBe("ok");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  describe("public YouTube URL native video input", () => {
    const youtubeChunk: VideoChunk = {
      ...BASE_CHUNK,
      mediaReference: { type: "YOUTUBE_URL", url: "https://www.youtube.com/watch?v=abc123" },
    };

    it("passes the YouTube URL as an actual media part, not as text", async () => {
      const payload = {
        videoInputAnalysed: true,
        nativeAudioAnalysed: true,
        visualFramesAnalysed: true,
        recognised: true,
        brandName: "Higgsfield",
        brandDomain: null,
        placementType: "SPONSORED_INTEGRATION",
        sponsorshipConfirmed: true,
        confidenceScore: 0.95,
        startTimestampSeconds: 393,
        endTimestampSeconds: 410,
        evidence: [
          { source: "VIDEO_AUDIO", timestampSeconds: 393, text: "Higgsfield who are the sponsor of today's video...", strength: 0.95 },
        ],
        reason: "Heard in the real audio.",
      };
      const generateContent = vi.fn().mockResolvedValue(geminiResponse(payload, ["VIDEO"]));
      const client = { models: { generateContent }, files: { upload: vi.fn(), get: vi.fn() } } as unknown as GoogleGenAI;

      const result = await provider(client).analyseChunk(youtubeChunk, BASE_CONTEXT);

      const call = generateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<Record<string, unknown>> }> };
      const parts = call.contents[0].parts;
      const mediaPart = parts.find((p) => "fileData" in p) as { fileData: { fileUri: string; mimeType: string } };
      expect(mediaPart).toBeDefined();
      expect(mediaPart.fileData.fileUri).toBe("https://www.youtube.com/watch?v=abc123");
      // The URL must be its own real media part, never smuggled into the prompt text.
      const textPart = parts.find((p) => "text" in p) as { text: string };
      expect(textPart.text).not.toContain("fileData");

      expect(result.analysisInputs.mediaSourceMethod).toBe("YOUTUBE_URL");
      expect(result.analysisInputs.videoInputAnalysed).toBe(true);
      expect(result.analysisInputs.nativeAudioAnalysed).toBe(true);
      expect(result.analysisInputs.visualFramesAnalysed).toBe(true);
      expect(result.evidence[0].strength).toBe(0.95);
    });

    it("scopes the request to the chunk's own time window via videoMetadata offsets", async () => {
      const chunk: VideoChunk = { ...youtubeChunk, startSeconds: 120, endSeconds: 180 };
      const generateContent = vi.fn().mockResolvedValue(geminiResponse(NO_SPONSOR_TEXT_ONLY_PAYLOAD, ["VIDEO"]));
      const client = { models: { generateContent }, files: { upload: vi.fn(), get: vi.fn() } } as unknown as GoogleGenAI;

      await provider(client).analyseChunk(chunk, BASE_CONTEXT);

      const call = generateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<Record<string, unknown>> }> };
      const mediaPart = call.contents[0].parts.find((p) => "fileData" in p) as {
        videoMetadata: { startOffset: string; endOffset: string };
      };
      expect(mediaPart.videoMetadata).toEqual({ startOffset: "120s", endOffset: "180s" });
    });

    it("falls back to a text-only request, records the error, and never claims video was analysed, when Gemini never actually ingests the video", async () => {
      // Gemini returns HTTP 200 with a plausible-looking response, but its own usage
      // metadata shows no VIDEO/AUDIO tokens at all — i.e. it silently ignored the
      // media reference (e.g. an inaccessible video). This must be treated as a
      // failure, not a quiet downgrade.
      const dishonestPayload = { ...NO_SPONSOR_TEXT_ONLY_PAYLOAD, videoInputAnalysed: true, nativeAudioAnalysed: true };
      const generateContent = vi
        .fn()
        .mockResolvedValue(geminiResponse(dishonestPayload, ["TEXT"])); // no VIDEO/AUDIO modality ever
      const client = { models: { generateContent }, files: { upload: vi.fn(), get: vi.fn() } } as unknown as GoogleGenAI;

      const resultPromise = provider(client).analyseChunk(youtubeChunk, BASE_CONTEXT);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.analysisInputs.videoInputAnalysed).toBe(false);
      expect(result.analysisInputs.nativeAudioAnalysed).toBe(false);
      expect(result.analysisInputs.providerError).toContain("Gemini could not access the public YouTube video");
      // 3 attempts against the media request (MAX_RETRIES=2) + 1 text-only fallback call.
      expect(generateContent).toHaveBeenCalledTimes(4);
    });
  });

  describe("no media input at all (transcript/description only)", () => {
    it("is visibly labelled as transcript-and-description-only, never VIDEO_AUDIO/VIDEO_VISUAL", async () => {
      const client = fakeClient(() => geminiResponse(NO_SPONSOR_TEXT_ONLY_PAYLOAD, ["TEXT"]));

      const result = await provider(client).analyseChunk(BASE_CHUNK, {
        ...BASE_CONTEXT,
        transcriptSegments: [{ startSeconds: 0, durationSeconds: 5, text: "hello" }],
      });

      expect(result.analysisInputs.mediaSourceMethod).toBe("NONE");
      expect(result.analysisInputs.videoInputAnalysed).toBe(false);
      expect(result.analysisInputs.nativeAudioAnalysed).toBe(false);
      expect(result.analysisInputs.visualFramesAnalysed).toBe(false);
      expect(result.analysisInputs.transcriptProvided).toBe(true);
      expect(result.analysisInputs.descriptionProvided).toBe(true);
    });

    it("rejects (downgrades) VIDEO_AUDIO evidence when no media input was supplied", async () => {
      const payload = {
        ...NO_SPONSOR_TEXT_ONLY_PAYLOAD,
        recognised: true,
        brandName: "Acme",
        nativeAudioAnalysed: true, // the model wrongly claims this despite no media
        evidence: [{ source: "VIDEO_AUDIO", timestampSeconds: 5, text: "Heard sponsor mention.", strength: 0.95 }],
      };
      const client = fakeClient(() => geminiResponse(payload, ["TEXT"]));

      const result = await provider(client).analyseChunk(BASE_CHUNK, BASE_CONTEXT);

      expect(result.analysisInputs.nativeAudioAnalysed).toBe(false);
      const evidence = result.evidence[0];
      expect(evidence.strength).toBeLessThanOrEqual(0.3);
      expect(evidence.metadata?.unconfirmedMediaInput).toBe(true);
    });

    it("rejects (downgrades) VIDEO_VISUAL evidence when no media input was supplied", async () => {
      const payload = {
        ...NO_SPONSOR_TEXT_ONLY_PAYLOAD,
        recognised: true,
        brandName: "Acme",
        visualFramesAnalysed: true, // wrongly claimed
        evidence: [{ source: "VIDEO_VISUAL", timestampSeconds: 5, text: "Saw a logo.", strength: 0.9 }],
      };
      const client = fakeClient(() => geminiResponse(payload, ["TEXT"]));

      const result = await provider(client).analyseChunk(BASE_CHUNK, BASE_CONTEXT);

      expect(result.analysisInputs.visualFramesAnalysed).toBe(false);
      const evidence = result.evidence[0];
      expect(evidence.strength).toBeLessThanOrEqual(0.3);
      expect(evidence.metadata?.unconfirmedMediaInput).toBe(true);
    });
  });

  describe("authorised uploaded-file fallback route", () => {
    it("still works as a secondary media source alongside YOUTUBE_URL", async () => {
      const chunk: VideoChunk = {
        ...BASE_CHUNK,
        mediaReference: { type: "GEMINI_FILE", uri: "files/abc123", mimeType: "video/mp4" },
      };
      const payload = { ...NO_SPONSOR_TEXT_ONLY_PAYLOAD, videoInputAnalysed: true };
      const generateContent = vi.fn().mockResolvedValue(geminiResponse(payload, ["VIDEO"]));
      const client = { models: { generateContent }, files: { upload: vi.fn(), get: vi.fn() } } as unknown as GoogleGenAI;

      const result = await provider(client).analyseChunk(chunk, BASE_CONTEXT);

      const call = generateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<Record<string, unknown>> }> };
      const mediaPart = call.contents[0].parts.find((p) => "fileData" in p) as { fileData: { fileUri: string; mimeType: string } };
      expect(mediaPart.fileData).toEqual({ fileUri: "files/abc123", mimeType: "video/mp4" });
      expect(result.analysisInputs.mediaSourceMethod).toBe("GEMINI_FILE");
      expect(result.analysisInputs.videoInputAnalysed).toBe(true);
    });
  });
});
