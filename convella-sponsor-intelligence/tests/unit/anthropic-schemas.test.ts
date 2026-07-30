import { describe, expect, it } from "vitest";
import { aiClassificationResponseSchema, competitorSuggestionsResponseSchema } from "@/lib/anthropic/schemas";
import { sponsorRecognitionResultSchema } from "@/lib/video-analysis/types";
import { extractJsonPayload } from "@/lib/json-extract";

describe("aiClassificationResponseSchema", () => {
  it("accepts a valid confirmed-detection response", () => {
    const payload = {
      detections: [
        {
          rawBrandName: "CodeRabbit",
          canonicalBrandName: "CodeRabbit",
          brandDomain: "coderabbit.ai",
          brandCategory: "AI developer tools",
          placementType: "SPONSORED_INTEGRATION",
          startTimestampSeconds: 132,
          endTimestampSeconds: 198,
          evidenceText: "The creator explicitly thanks CodeRabbit for sponsoring the video.",
          evidenceSource: "VIDEO_AUDIO",
          confidenceScore: 0.98,
          reasoningSummary: "Explicit sponsorship statement with matching visuals and description link.",
          promotionalUrl: "https://coderabbit.ai/",
          discountCode: null,
          callToAction: "Try CodeRabbit using the link below.",
          sponsorshipConfirmed: true,
        },
      ],
      noSponsorshipReason: null,
    };
    expect(() => aiClassificationResponseSchema.parse(payload)).not.toThrow();
  });

  it("accepts a valid no-sponsorship response", () => {
    const payload = { detections: [], noSponsorshipReason: "No explicit or sufficiently strong commercial evidence was identified." };
    expect(() => aiClassificationResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects a response with an invalid placement type", () => {
    const payload = {
      detections: [
        {
          rawBrandName: "X",
          canonicalBrandName: "X",
          brandDomain: null,
          brandCategory: null,
          placementType: "NOT_A_REAL_TYPE",
          startTimestampSeconds: null,
          endTimestampSeconds: null,
          evidenceText: "x",
          evidenceSource: "TRANSCRIPT",
          confidenceScore: 0.5,
          reasoningSummary: "x",
          promotionalUrl: null,
          discountCode: null,
          callToAction: null,
          sponsorshipConfirmed: false,
        },
      ],
      noSponsorshipReason: null,
    };
    expect(() => aiClassificationResponseSchema.parse(payload)).toThrow();
  });

  it("rejects a confidence score outside 0-1", () => {
    expect(() =>
      aiClassificationResponseSchema.parse({
        detections: [
          {
            rawBrandName: "X",
            canonicalBrandName: "X",
            brandDomain: null,
            brandCategory: null,
            placementType: "UNKNOWN",
            startTimestampSeconds: null,
            endTimestampSeconds: null,
            evidenceText: "x",
            evidenceSource: "TRANSCRIPT",
            confidenceScore: 1.5,
            reasoningSummary: "x",
            promotionalUrl: null,
            discountCode: null,
            callToAction: null,
            sponsorshipConfirmed: false,
          },
        ],
        noSponsorshipReason: null,
      }),
    ).toThrow();
  });
});

describe("competitorSuggestionsResponseSchema", () => {
  it("caps competitor suggestions at 5", () => {
    const competitors = Array.from({ length: 6 }, (_, i) => ({
      suggestedBrandName: `Brand ${i}`,
      suggestedDomain: null,
      category: null,
      reason: "similar",
      confidenceScore: 0.5,
    }));
    expect(() => competitorSuggestionsResponseSchema.parse({ competitors })).toThrow();
  });
});

describe("sponsorRecognitionResultSchema", () => {
  it("validates a well-formed chunk analysis response", () => {
    const payload = {
      recognised: true,
      brandName: "Acme",
      brandDomain: "acme.com",
      placementType: "DEDICATED_VIDEO",
      sponsorshipConfirmed: true,
      confidenceScore: 0.95,
      startTimestampSeconds: 10,
      endTimestampSeconds: 60,
      evidence: [{ source: "VIDEO_AUDIO", timestampSeconds: 10, text: "Sponsored by Acme.", strength: 0.9 }],
      reason: "Explicit disclosure.",
    };
    expect(() => sponsorRecognitionResultSchema.parse(payload)).not.toThrow();
  });

  it("rejects an unknown evidence source", () => {
    const payload = {
      recognised: false,
      brandName: null,
      brandDomain: null,
      placementType: null,
      sponsorshipConfirmed: false,
      confidenceScore: 0,
      startTimestampSeconds: null,
      endTimestampSeconds: null,
      evidence: [{ source: "SOCIAL_MEDIA", timestampSeconds: null, text: "x", strength: 0.1 }],
      reason: "x",
    };
    expect(() => sponsorRecognitionResultSchema.parse(payload)).toThrow();
  });
});

describe("extractJsonPayload", () => {
  it("strips markdown code fences", () => {
    const raw = '```json\n{"a":1}\n```';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it("extracts JSON surrounded by prose", () => {
    const raw = 'Sure, here is the result:\n{"a":1}\nHope that helps!';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it("handles a raw JSON array", () => {
    const raw = "[1,2,3]";
    expect(JSON.parse(extractJsonPayload(raw))).toEqual([1, 2, 3]);
  });
});
