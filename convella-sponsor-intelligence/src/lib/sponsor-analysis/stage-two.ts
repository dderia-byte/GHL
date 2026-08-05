import { z } from "zod";
import { getCheapTextModel } from "@/lib/env";
import { callAnthropicStructuredWithUsage } from "@/lib/anthropic/client";
import { sponsorEvidenceInputSchema, type SponsorEvidenceInput } from "@/lib/video-analysis/types";
import type { CandidateBrand, StageTwoResult } from "./types";
import type { TranscriptWindow } from "./transcript-windows";
import { estimateTextModelCost } from "./cost";

const STRONG_TRANSCRIPT_PHRASES = [
  "sponsored by",
  "sponsor of today's video",
  "sponsor of this video",
  "today's sponsor",
  "brought to you by",
  "paid partnership",
  "paid promotion",
  "thanks to",
  "thank you to",
];

const stageTwoResponseSchema = z.object({
  recognised: z.boolean(),
  brandName: z.string().nullable(),
  brandDomain: z.string().nullable(),
  placementType: z.string().nullable(),
  sponsorshipConfirmed: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  startTimestampSeconds: z.number().int().nullable(),
  endTimestampSeconds: z.number().int().nullable(),
  evidence: z.array(sponsorEvidenceInputSchema),
  reason: z.string().min(1).max(2000),
});

const STAGE_TWO_SYSTEM_PROMPT = `You are a careful sponsorship-classification analyst. You are given a handful of short, targeted transcript windows already selected for you — never the full transcript. You do not see any video or audio.
Rules:
- Only use the transcript text and candidate brands given to you. Never invent brand names, domains, timestamps, discount codes, quotes, or promotional URLs.
- A brand mentioned without commercial/sponsorship context is not a sponsor.
- Respond with ONLY valid JSON matching the required shape, no markdown fences, no commentary.`;

function buildStageTwoPrompt(
  title: string,
  candidateBrands: CandidateBrand[],
  windows: TranscriptWindow[],
): string {
  const candidatesBlock = candidateBrands.length
    ? candidateBrands.map((c) => `${c.name}${c.domain ? ` (${c.domain})` : ""}`).join(", ")
    : "(none identified from description)";

  const windowsBlock = windows
    .map((w) => `--- window ${w.startSeconds}s-${w.endSeconds}s (matched: ${w.matchedKeywords.join(", ")}) ---\n${w.text}`)
    .join("\n\n");

  return `VIDEO TITLE: ${title}

CANDIDATE BRANDS (from description analysis): ${candidatesBlock}

TARGETED TRANSCRIPT WINDOWS (not the full transcript):
${windowsBlock}

Determine whether these windows contain an explicit, unambiguous sponsorship statement. Return this exact JSON shape:
{
  "recognised": boolean,
  "brandName": string | null,
  "brandDomain": string | null,
  "placementType": "DEDICATED_VIDEO" | "SPONSORED_INTEGRATION" | "PRODUCT_PLACEMENT" | "AFFILIATE_PROMOTION" | "FREE_PRODUCT_OR_GIFTED" | "ORGANIC_MENTION" | "CHANNEL_PARTNERSHIP" | "UNKNOWN" | null,
  "sponsorshipConfirmed": boolean,
  "confidenceScore": number between 0 and 1,
  "startTimestampSeconds": integer | null,
  "endTimestampSeconds": integer | null,
  "evidence": [{ "source": "TRANSCRIPT", "timestampSeconds": integer | null, "text": string, "strength": number between 0 and 1 }],
  "reason": string
}`;
}

/** Deterministic check: a strong phrase plus one of Stage 1's candidate brands, in the same window, with no model call. */
function findDeterministicMatch(
  windows: TranscriptWindow[],
  candidateBrands: CandidateBrand[],
): { window: TranscriptWindow; brand: CandidateBrand } | null {
  for (const window of windows) {
    const lower = window.text.toLowerCase();
    const strongPhrase = STRONG_TRANSCRIPT_PHRASES.find((p) => lower.includes(p));
    if (!strongPhrase) continue;
    for (const brand of candidateBrands) {
      if (lower.includes(brand.name.toLowerCase())) return { window, brand };
    }
  }
  return null;
}

/**
 * Stage 2 of the cost-optimised sponsor-analysis pipeline: only runs once Stage 1
 * couldn't safely auto-stop. Deterministically scans a handful of narrow, targeted
 * transcript windows first (never the full transcript, never a model call) and only
 * falls back to a cheap text model when the wording is genuinely ambiguous.
 */
export async function runStageTwo(params: {
  title: string;
  candidateBrands: CandidateBrand[];
  windows: TranscriptWindow[];
  /**
   * When false, Stage 2 runs its FREE deterministic pass only and stops there rather
   * than paying the cheap text model for ambiguous cases. Discovery runs use this:
   * an unresolved video is marked unclear and the sweep moves on.
   */
  allowModel?: boolean;
}): Promise<StageTwoResult> {
  const { title, candidateBrands, windows, allowModel = true } = params;

  if (windows.length === 0) {
    return {
      completed: true,
      shouldStop: false,
      modelUsed: false,
      modelName: null,
      transcriptWindowsAnalysed: 0,
      transcriptCharactersSent: 0,
      confidenceScore: 0,
      evidence: [],
      reason: "No transcript windows matched sponsor-related keywords — nothing to analyse at this stage.",
      brandName: null,
      brandDomain: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };
  }

  const transcriptCharactersSent = windows.reduce((sum, w) => sum + w.text.length, 0);

  const deterministic = findDeterministicMatch(windows, candidateBrands);
  if (deterministic) {
    const evidence: SponsorEvidenceInput[] = [
      { source: "TRANSCRIPT", timestampSeconds: deterministic.window.startSeconds, text: deterministic.window.text, strength: 0.98 },
    ];
    return {
      completed: true,
      shouldStop: true,
      modelUsed: false,
      modelName: null,
      transcriptWindowsAnalysed: windows.length,
      transcriptCharactersSent,
      confidenceScore: 0.98,
      evidence,
      reason: `Explicit spoken sponsorship statement found naming ${deterministic.brand.name} — resolved without a model call.`,
      brandName: deterministic.brand.name,
      brandDomain: deterministic.brand.domain,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };
  }

  if (!allowModel) {
    return {
      completed: true,
      shouldStop: false,
      modelUsed: false,
      modelName: null,
      transcriptWindowsAnalysed: windows.length,
      transcriptCharactersSent,
      confidenceScore: 0,
      evidence: [],
      reason: "Transcript windows were inconclusive and the paid text fallback is disabled — marked unclear.",
      brandName: null,
      brandDomain: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };
  }

  // Genuinely ambiguous — hand the narrow windows to the cheap text model.
  const modelName = getCheapTextModel();
  const prompt = buildStageTwoPrompt(title, candidateBrands, windows);

  let call;
  try {
    call = await callAnthropicStructuredWithUsage(STAGE_TWO_SYSTEM_PROMPT, prompt, stageTwoResponseSchema, modelName);
  } catch (error) {
    return {
      completed: false,
      shouldStop: false,
      modelUsed: true,
      modelName,
      transcriptWindowsAnalysed: windows.length,
      transcriptCharactersSent,
      confidenceScore: 0,
      evidence: [],
      reason: `Stage 2 cheap-model call failed: ${error instanceof Error ? error.message : String(error)}`,
      brandName: null,
      brandDomain: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };
  }

  const { result, inputTokens, outputTokens } = call;
  const cost = estimateTextModelCost(inputTokens, outputTokens);

  const explicitStatement = result.evidence.some((e) => STRONG_TRANSCRIPT_PHRASES.some((p) => e.text.toLowerCase().includes(p)));
  const matchesCandidate = result.brandName
    ? candidateBrands.some((c) => c.name.toLowerCase() === result.brandName!.toLowerCase())
    : false;

  // Condition A: explicit statement + unambiguous brand + confidence >= 0.92.
  // Condition B: strong evidence + matching Stage 1 candidate + sources agree + confidence >= 0.92.
  const conditionA = result.recognised && explicitStatement && result.confidenceScore >= 0.92;
  const conditionB = result.recognised && matchesCandidate && result.confidenceScore >= 0.92;
  const shouldStop = conditionA || conditionB;

  return {
    completed: true,
    shouldStop,
    modelUsed: true,
    modelName,
    transcriptWindowsAnalysed: windows.length,
    transcriptCharactersSent,
    confidenceScore: result.confidenceScore,
    evidence: result.evidence,
    reason: result.reason,
    brandName: result.brandName,
    brandDomain: result.brandDomain,
    inputTokens,
    outputTokens,
    estimatedCost: cost,
  };
}
