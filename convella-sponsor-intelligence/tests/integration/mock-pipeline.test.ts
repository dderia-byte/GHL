import { describe, expect, it } from "vitest";
import { MockVideoAnalysisProvider, DEFAULT_MOCK_SCRIPT } from "@/lib/video-analysis/providers/mock";
import { MockTranscriptProvider } from "@/lib/transcript/providers/mock";
import { analyseDescription } from "@/lib/signals/description";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";
import { evaluateSponsorshipDecision } from "@/lib/decision/engine";
import type { SponsorEvidenceInput } from "@/lib/video-analysis/types";
import type { AnalysisMode } from "@/generated/prisma/enums";

/**
 * Mirrors the sequential chunk loop in src/lib/jobs/video-analysis-pipeline.ts, but
 * entirely in memory (no database), so it can exercise the mock providers + decision
 * engine together as an integration test of first-sponsor-only vs. all-sponsors mode.
 */
async function simulateAnalysis(mode: AnalysisMode, chunkCount: number) {
  const description =
    "Thanks to CodeRabbit for sponsoring today's video! Try it free at https://coderabbit.ai/.";
  const descriptionSignals = analyseDescription(description);
  const metadataSignals = analyseYouTubeMetadata({ paidProductPlacement: true, tags: [], title: "t" });

  const transcriptProvider = new MockTranscriptProvider();
  const transcript = await transcriptProvider.getTranscript("vid1");
  const provider = new MockVideoAnalysisProvider();

  const observations: SponsorEvidenceInput[] = [];
  const stops: number[] = [];
  let chunksRun = 0;

  for (let i = 0; i < chunkCount; i += 1) {
    const chunkResult = await provider.analyseChunk(
      { videoId: "vid1", startSeconds: i * 10, endSeconds: (i + 1) * 10, mediaReference: "" },
      {
        title: "A video",
        description,
        transcriptSegments: transcript.segments,
        previousObservations: observations,
        candidateBrands: descriptionSignals.candidateBrands,
      },
    );
    observations.push(...chunkResult.evidence);
    chunksRun += 1;

    const evaluation = evaluateSponsorshipDecision({
      chunkResult,
      accumulatedEvidence: observations,
      descriptionSignals,
      metadataSignals,
    });

    if (evaluation.shouldStop) {
      stops.push(i);
      if (mode === "FIRST_SPONSOR_ONLY") break;
    }
  }

  return { stops, chunksRun };
}

describe("sequential analysis loop — FIRST_SPONSOR_ONLY", () => {
  it("stops immediately after the first confirmed sponsor and does not analyse further chunks", async () => {
    const { stops, chunksRun } = await simulateAnalysis("FIRST_SPONSOR_ONLY", DEFAULT_MOCK_SCRIPT.length + 3);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(1);
    // Chunk index 1 is where the mock script confirms the sponsor (0-indexed) — the
    // loop must not have run beyond that chunk.
    expect(chunksRun).toBe(2);
  });
});

describe("sequential analysis loop — ALL_SPONSORS", () => {
  it("continues analysing after the first confirmed sponsor instead of stopping", async () => {
    const { stops, chunksRun } = await simulateAnalysis("ALL_SPONSORS", DEFAULT_MOCK_SCRIPT.length + 3);
    expect(stops).toHaveLength(1);
    expect(chunksRun).toBe(DEFAULT_MOCK_SCRIPT.length + 3);
  });
});
