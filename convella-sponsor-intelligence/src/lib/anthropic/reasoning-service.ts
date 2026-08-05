import { hasAnthropicCredentials, getReasoningModel } from "@/lib/env";
import { domainMatchesBrand } from "@/lib/brand/normalize";
import type { DescriptionSignals } from "@/lib/signals/description";
import type { SponsorEvidenceInput } from "@/lib/video-analysis/types";
import { callAnthropicStructured, callAnthropicStructuredWithUsage } from "./client";
import {
  aiClassificationResponseSchema,
  competitorSuggestionsResponseSchema,
  type AiDetection,
  type CompetitorSuggestion,
} from "./schemas";

export interface ClassificationRequest {
  videoTitle: string;
  description: string;
  brandName: string;
  brandDomain: string | null;
  evidence: SponsorEvidenceInput[];
  descriptionSignals: DescriptionSignals;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are a careful sponsorship-classification analyst for an influencer-marketing agency.
You are given evidence already gathered by a separate video-analysis system — you do not watch video yourself.
Your job is strictly classification and summarisation of the evidence you are given.
Rules:
- Never invent brand names, domains, timestamps, discount codes, quotes, or URLs that are not present in the evidence provided.
- If evidence is insufficient to name a domain or category confidently, return null for that field.
- Respond with ONLY valid JSON, no markdown fences, no commentary.`;

function buildClassificationPrompt(req: ClassificationRequest): string {
  const evidenceBlock = req.evidence
    .map((e) => `- [${e.source}${e.timestampSeconds !== null ? ` @${e.timestampSeconds}s` : ""}] ${e.text}`)
    .join("\n");

  return `VIDEO TITLE: ${req.videoTitle}

DESCRIPTION (may be truncated):
"""
${req.description.slice(0, 4000)}
"""

CANDIDATE BRAND: ${req.brandName}${req.brandDomain ? ` (domain: ${req.brandDomain})` : ""}

DESCRIPTION URLS: ${req.descriptionSignals.urls.join(", ") || "(none)"}
DESCRIPTION DISCOUNT CODES: ${req.descriptionSignals.discountCodes.join(", ") || "(none)"}

ACCUMULATED EVIDENCE:
${evidenceBlock || "(no evidence)"}

Return a JSON object of this exact shape:
{
  "detections": [
    {
      "rawBrandName": string,
      "canonicalBrandName": string,
      "brandDomain": string | null,
      "brandCategory": string | null,
      "placementType": "DEDICATED_VIDEO" | "SPONSORED_INTEGRATION" | "PRODUCT_PLACEMENT" | "AFFILIATE_PROMOTION" | "FREE_PRODUCT_OR_GIFTED" | "ORGANIC_MENTION" | "CHANNEL_PARTNERSHIP" | "UNKNOWN",
      "startTimestampSeconds": integer | null,
      "endTimestampSeconds": integer | null,
      "evidenceText": string,
      "evidenceSource": "VIDEO_AUDIO" | "VIDEO_VISUAL" | "TRANSCRIPT" | "DESCRIPTION" | "YOUTUBE_METADATA",
      "confidenceScore": number between 0 and 1,
      "reasoningSummary": string,
      "promotionalUrl": string | null,
      "discountCode": string | null,
      "callToAction": string | null,
      "sponsorshipConfirmed": boolean
    }
  ],
  "noSponsorshipReason": string | null
}
If the evidence does not support a sponsorship, return an empty "detections" array and explain why in "noSponsorshipReason".`;
}

function heuristicPlacementType(evidence: SponsorEvidenceInput[]): AiDetection["placementType"] {
  const joined = evidence.map((e) => e.text.toLowerCase()).join(" ");
  if (/affiliate/.test(joined)) return "AFFILIATE_PROMOTION";
  if (/gifted|free product|sent (us|me) (a|the)/.test(joined)) return "FREE_PRODUCT_OR_GIFTED";
  if (/sponsored by|brought to you by|thanks to .+ for sponsoring/.test(joined)) return "SPONSORED_INTEGRATION";
  return "UNKNOWN";
}

/** Deterministic fallback used when Anthropic is not configured — not a fake AI call, just a documented heuristic. */
/**
 * Deterministic classification with no model call at all — used both when Anthropic
 * isn't configured, and deliberately by the sponsor-analysis pipeline for any sponsor
 * resolved at Stage 1 (a confident, explicit description-level disclosure already
 * carries enough signal that spending a reasoning-model call to reclassify it would
 * defeat the entire point of stopping at the cheapest possible stage).
 */
export function classifyWithHeuristicFallback(req: ClassificationRequest): AiDetection {
  const strongest = [...req.evidence].sort((a, b) => b.strength - a.strength)[0];
  const matchingUrl = req.descriptionSignals.urls.find(
    (u) => req.brandDomain && domainMatchesBrand(u, req.brandDomain),
  );
  const timestamps = req.evidence.map((e) => e.timestampSeconds).filter((t): t is number => t !== null);

  return {
    rawBrandName: req.brandName,
    canonicalBrandName: req.brandName,
    brandDomain: req.brandDomain,
    brandCategory: null,
    placementType: heuristicPlacementType(req.evidence),
    startTimestampSeconds: timestamps.length ? Math.min(...timestamps) : null,
    endTimestampSeconds: timestamps.length ? Math.max(...timestamps) : null,
    evidenceText: strongest?.text ?? "No direct evidence text available.",
    evidenceSource: strongest?.source ?? "DESCRIPTION",
    confidenceScore: strongest?.strength ?? 0,
    reasoningSummary: `Deterministic classification (no reasoning-model call made) based on ${req.evidence.length} evidence item(s) referencing ${req.brandName}.`,
    promotionalUrl: matchingUrl ?? null,
    discountCode: req.descriptionSignals.discountCodes[0] ?? null,
    callToAction: req.descriptionSignals.callsToAction[0] ?? null,
    sponsorshipConfirmed: false,
  };
}

/**
 * Produces the final structured classification (canonical brand, domain, category,
 * placement type, reasoning summary) for a candidate brand from accumulated evidence.
 * Uses Anthropic when configured; otherwise falls back to a deterministic heuristic
 * so the pipeline still functions without API credentials.
 */
export async function classifySponsorship(req: ClassificationRequest): Promise<AiDetection> {
  const { detection } = await classifySponsorshipWithUsage(req);
  return detection;
}

/** Same as {@link classifySponsorship} but also reports real token usage, for the sponsor-analysis pipeline's cost tracking. Uses REASONING_MODEL (falls back to ANTHROPIC_MODEL). */
export async function classifySponsorshipWithUsage(
  req: ClassificationRequest,
): Promise<{ detection: AiDetection; inputTokens: number; outputTokens: number }> {
  if (!hasAnthropicCredentials()) return { detection: classifyWithHeuristicFallback(req), inputTokens: 0, outputTokens: 0 };

  const prompt = buildClassificationPrompt(req);
  const { result, inputTokens, outputTokens } = await callAnthropicStructuredWithUsage(
    CLASSIFICATION_SYSTEM_PROMPT,
    prompt,
    aiClassificationResponseSchema,
    getReasoningModel(),
  );

  return { detection: result.detections[0] ?? classifyWithHeuristicFallback(req), inputTokens, outputTokens };
}

const COMPETITOR_SYSTEM_PROMPT = `You are a market-research assistant for an influencer-marketing agency.
Given a brand name, domain and category, suggest up to five plausible competitor brands.
These are AI-generated suggestions for research purposes only — never present them as confirmed facts.
If you are not reasonably confident of a competitor's domain, return null rather than guessing.
Respond with ONLY valid JSON, no markdown fences, no commentary.`;

/** AI-generated competitor suggestions for a confirmed brand. Always label these as suggestions, not facts. */
export async function suggestCompetitors(brand: {
  canonicalName: string;
  domain: string | null;
  category: string | null;
}): Promise<CompetitorSuggestion[]> {
  if (!hasAnthropicCredentials()) return [];

  const prompt = `BRAND: ${brand.canonicalName}
DOMAIN: ${brand.domain ?? "(unknown)"}
CATEGORY: ${brand.category ?? "(unknown)"}

Return JSON: { "competitors": [ { "suggestedBrandName": string, "suggestedDomain": string | null, "category": string | null, "reason": string, "confidenceScore": number between 0 and 1 } ] } with at most 5 entries.`;

  const result = await callAnthropicStructured(COMPETITOR_SYSTEM_PROMPT, prompt, competitorSuggestionsResponseSchema);
  return result.competitors;
}
