import { describe, expect, it } from "vitest";
import { evaluateSponsorshipDecision } from "@/lib/decision/engine";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import type { AnalysisInputsUsed, SponsorEvidenceInput, SponsorRecognitionResult } from "@/lib/video-analysis/types";

const noMetadataSignal = analyseYouTubeMetadata({ paidProductPlacement: false, tags: [], title: "x" });

// The decision engine only reads brandName/recognised/evidence/reason/timestamps from a
// chunk result — analysisInputs is irrelevant to its scoring, so every test case here
// shares this placeholder value.
const testAnalysisInputs: AnalysisInputsUsed = {
  mediaSourceMethod: "NONE",
  videoInputAnalysed: false,
  nativeAudioAnalysed: false,
  visualFramesAnalysed: false,
  transcriptProvided: true,
  descriptionProvided: true,
  model: "test",
  providerError: null,
};

describe("evaluateSponsorshipDecision — confirmed sponsor", () => {
  it("stops with high confidence when an explicit spoken statement, on-screen branding and a matching description link all agree", () => {
    const descriptionSignals = analyseDescription(
      "Thanks to CodeRabbit for sponsoring this video! Try it for free at https://coderabbit.ai/try.",
    );
    const evidence: SponsorEvidenceInput[] = [
      { source: "VIDEO_AUDIO", timestampSeconds: 45, text: "Thanks to CodeRabbit for sponsoring today's video.", strength: 0.95 },
      { source: "VIDEO_VISUAL", timestampSeconds: 50, text: "CodeRabbit logo and dashboard shown on screen.", strength: 0.8 },
      { source: "DESCRIPTION", timestampSeconds: null, text: "Try it for free at https://coderabbit.ai/try.", strength: 0.9 },
      { source: "TRANSCRIPT", timestampSeconds: 46, text: "CodeRabbit reviews your pull requests automatically.", strength: 0.6 },
    ];
    const chunkResult: SponsorRecognitionResult = {
      recognised: true,
      brandName: "CodeRabbit",
      brandDomain: "coderabbit.ai",
      placementType: "SPONSORED_INTEGRATION",
      sponsorshipConfirmed: true,
      confidenceScore: 0.9,
      startTimestampSeconds: 45,
      endTimestampSeconds: 100,
      evidence,
      reason: "Explicit sponsorship statement with corroborating evidence.",
      analysisInputs: testAnalysisInputs,
    };

    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });

    expect(result.shouldStop).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
    expect(result.explicitSignalPresent).toBe(true);
    expect(result.brandUnambiguous).toBe(true);
    expect(result.createDetection).toBe(true);
  });
});

describe("evaluateSponsorshipDecision — organic mention", () => {
  it("does not stop for a brief logo appearance or an ordinary tool mention", () => {
    const descriptionSignals = analyseDescription("A link to the documentation is below if you want to learn more.");
    const evidence: SponsorEvidenceInput[] = [
      { source: "TRANSCRIPT", timestampSeconds: 120, text: "One of the tools I use daily is Warp, a modern terminal.", strength: 0.2 },
      { source: "VIDEO_VISUAL", timestampSeconds: 125, text: "The Warp terminal interface appears briefly.", strength: 0.3 },
    ];
    const chunkResult: SponsorRecognitionResult = {
      recognised: false,
      brandName: "Warp",
      brandDomain: null,
      placementType: "ORGANIC_MENTION",
      sponsorshipConfirmed: false,
      confidenceScore: 0.2,
      startTimestampSeconds: 120,
      endTimestampSeconds: null,
      evidence,
      reason: "No disclosure or promotional context.",
      analysisInputs: testAnalysisInputs,
    };

    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });

    expect(result.shouldStop).toBe(false);
    expect(result.brandUnambiguous).toBe(false);
    expect(result.confidenceScore).toBeLessThan(0.5);
  });

  it("never stops purely because a brand was recognised, regardless of score, when recognised is false", () => {
    const descriptionSignals = analyseDescription("");
    const chunkResult: SponsorRecognitionResult = {
      recognised: false,
      brandName: "SomeBrand",
      brandDomain: "somebrand.com",
      placementType: "PRODUCT_PLACEMENT",
      sponsorshipConfirmed: false,
      confidenceScore: 0.95,
      startTimestampSeconds: 10,
      endTimestampSeconds: 20,
      evidence: [{ source: "VIDEO_VISUAL", timestampSeconds: 10, text: "SomeBrand product appears in a comparison.", strength: 0.9 }],
      reason: "Just a comparison, not a sponsorship.",
      analysisInputs: testAnalysisInputs,
    };
    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: chunkResult.evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });
    expect(result.shouldStop).toBe(false);
  });
});

describe("evaluateSponsorshipDecision — affiliate candidate", () => {
  it("creates a reviewable detection but does not stop when there is no explicit sponsorship statement", () => {
    const descriptionSignals = analyseDescription(
      "Some links below are affiliate links which support the channel. Check out Lumen Habits: https://lumenhabits.co/?ref=moderndevweekly",
    );
    const evidence: SponsorEvidenceInput[] = [
      { source: "DESCRIPTION", timestampSeconds: null, text: "Some links below are affiliate links which support the channel.", strength: 0.7 },
      { source: "TRANSCRIPT", timestampSeconds: 300, text: "I've been using Lumen Habits for a few months and recommend it.", strength: 0.5 },
    ];
    const chunkResult: SponsorRecognitionResult = {
      recognised: false,
      brandName: "Lumen Habits",
      brandDomain: "lumenhabits.co",
      placementType: "AFFILIATE_PROMOTION",
      sponsorshipConfirmed: false,
      confidenceScore: 0.6,
      startTimestampSeconds: 300,
      endTimestampSeconds: null,
      evidence,
      reason: "Affiliate disclosure and tracked link, but no explicit sponsorship statement.",
      analysisInputs: testAnalysisInputs,
    };

    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });

    expect(result.shouldStop).toBe(false);
    expect(result.createDetection).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.25);
    expect(result.confidenceScore).toBeLessThan(0.75);
  });
});

describe("evaluateSponsorshipDecision — ambiguous brand identity", () => {
  it("does not stop for a brand mention without a matching domain or explicit disclosure naming it", () => {
    const descriptionSignals = analyseDescription("");
    const evidence: SponsorEvidenceInput[] = [
      { source: "TRANSCRIPT", timestampSeconds: 30, text: "I asked Claude to help me refactor this function.", strength: 0.3 },
    ];
    const chunkResult: SponsorRecognitionResult = {
      recognised: false,
      brandName: "Claude",
      brandDomain: null,
      placementType: "UNKNOWN",
      sponsorshipConfirmed: false,
      confidenceScore: 0.3,
      startTimestampSeconds: 30,
      endTimestampSeconds: null,
      evidence,
      reason: "Ambiguous — no domain or sponsorship context ties this to a specific company.",
      analysisInputs: testAnalysisInputs,
    };
    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });
    expect(result.brandUnambiguous).toBe(false);
    expect(result.shouldStop).toBe(false);
  });
});

describe("evaluateSponsorshipDecision — contradictory evidence", () => {
  const descriptionSignals = analyseDescription("Thanks to Acme for sponsoring this video!");
  const baseEvidence: SponsorEvidenceInput[] = [
    { source: "VIDEO_AUDIO", timestampSeconds: 20, text: "Thanks to Acme for sponsoring this video.", strength: 0.9 },
  ];
  const baseChunkResult: SponsorRecognitionResult = {
    recognised: true,
    brandName: "Acme",
    brandDomain: "acme.com",
    placementType: "SPONSORED_INTEGRATION",
    sponsorshipConfirmed: true,
    confidenceScore: 0.9,
    startTimestampSeconds: 20,
    endTimestampSeconds: 40,
    evidence: baseEvidence,
    reason: "Explicit statement.",
    analysisInputs: testAnalysisInputs,
  };

  it("reduces confidence when contradictory evidence is present", () => {
    const withoutContradiction = evaluateSponsorshipDecision({
      chunkResult: baseChunkResult,
      accumulatedEvidence: baseEvidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });

    const contradictingEvidence: SponsorEvidenceInput[] = [
      ...baseEvidence,
      { source: "TRANSCRIPT", timestampSeconds: 25, text: "Actually this is just a normal comparison, not sponsored by Acme.", strength: 0.5 },
    ];
    const withContradiction = evaluateSponsorshipDecision({
      chunkResult: baseChunkResult,
      accumulatedEvidence: contradictingEvidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });

    expect(withContradiction.confidenceScore).toBeLessThan(withoutContradiction.confidenceScore);
  });
});

describe("evaluateSponsorshipDecision — below-threshold detections", () => {
  it("does not mark a detection worth creating when confidence is below 0.25", () => {
    const descriptionSignals = analyseDescription("");
    const evidence: SponsorEvidenceInput[] = [
      { source: "TRANSCRIPT", timestampSeconds: 5, text: "Someone mentioned NanoCorp in passing.", strength: 0.15 },
    ];
    const chunkResult: SponsorRecognitionResult = {
      recognised: false,
      brandName: "NanoCorp",
      brandDomain: null,
      placementType: "UNKNOWN",
      sponsorshipConfirmed: false,
      confidenceScore: 0.15,
      startTimestampSeconds: 5,
      endTimestampSeconds: null,
      evidence,
      reason: "Passing mention only.",
      analysisInputs: testAnalysisInputs,
    };
    const result = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: evidence,
      descriptionSignals,
      metadataSignals: noMetadataSignal,
    });
    expect(result.createDetection).toBe(false);
    expect(result.shouldStop).toBe(false);
  });
});
