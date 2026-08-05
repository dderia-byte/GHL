import { domainMatchesBrand } from "@/lib/brand/normalize";
import type { DescriptionSignals } from "@/lib/signals/description";
import type { YouTubeMetadataSignals } from "@/lib/signals/metadata";
import type { SponsorEvidenceInput } from "@/lib/video-analysis/types";
import type { CandidateBrand, StageOneResult } from "./types";

/**
 * Disclosure phrases strong and specific enough, on their own, to auto-stop the whole
 * pipeline at zero model cost. Deliberately narrower than
 * `DescriptionSignals.hasExplicitSponsorDisclosure` (which also matches weaker/more
 * ambiguous phrases like "thanks to" or "partnered with" — those still count as a
 * signal for Stage 2/3, but are too easily organic ("thanks to my patrons") to justify
 * a zero-verification auto-stop here).
 */
const STRONG_STOP_PHRASES = new Set([
  "sponsored by",
  "sponsor of today's video",
  "sponsor of this video",
  "today's sponsor",
  "brought to you by",
  "paid partnership",
  "paid promotion",
]);

const CTA_PATTERN = /try |use the link|sign up|check out|special offer|free trial|download|get started|learn more/i;

/**
 * Heuristic for "is this plausibly the creator's own product rather than a paid
 * third-party sponsorship". Deliberately conservative: a strong disclosure phrase
 * (sponsored by / paid partnership / brought to you by / etc.) inherently implies a
 * paid third-party relationship — creators don't describe their own product that way —
 * so it's only flagged true when no such phrase backs the candidate brand at all.
 */
function looksCreatorOwned(disclosureContext: string | undefined): boolean {
  if (!disclosureContext) return false;
  return /\b(my own|our own|i (built|created|made)|i'm the (founder|creator) of)\b/i.test(disclosureContext);
}

/**
 * Stage 1 of the cost-optimised sponsor-analysis pipeline: pure deterministic analysis
 * of title/description/metadata already extracted by `analyseDescription` /
 * `analyseYouTubeMetadata` — makes zero Anthropic or Gemini calls. Only stops the whole
 * pipeline here when a strong, unambiguous, video-specific sponsorship disclosure is
 * present; anything weaker is left for Stage 2/3 to corroborate.
 */
export function runStageOne(
  descriptionSignals: DescriptionSignals,
  metadataSignals: YouTubeMetadataSignals,
): StageOneResult {
  const candidateBrands: CandidateBrand[] = descriptionSignals.candidateBrands.map((name) => {
    const domain = descriptionSignals.domains.find((d) => domainMatchesBrand(d, name)) ?? null;
    return { name, domain };
  });

  const strongMatch = descriptionSignals.disclosureMatches.find((m) => STRONG_STOP_PHRASES.has(m.phrase));

  /**
   * Which candidate brands are named in the strong disclosure's OWN sentence. A
   * typical description lists several brands ("gear I use", affiliate links) while
   * disclosing exactly one sponsor — requiring the whole description to mention a
   * single brand would send those to a paid stage unnecessarily. Binding the brand to
   * the disclosure context resolves them for free without weakening the rule: it still
   * takes a strong phrase, and still refuses when the phrase itself names two brands.
   */
  const brandsInDisclosureContext = strongMatch
    ? candidateBrands.filter((b) => strongMatch.context.toLowerCase().includes(b.name.toLowerCase()))
    : [];
  const explicitCommercialSignal =
    descriptionSignals.hasExplicitSponsorDisclosure ||
    metadataSignals.paidProductPlacement ||
    descriptionSignals.discountCodes.length > 0;

  const baseEvidence: SponsorEvidenceInput[] = descriptionSignals.disclosureMatches.map((m) => ({
    source: "DESCRIPTION",
    timestampSeconds: null,
    text: m.context,
    strength: STRONG_STOP_PHRASES.has(m.phrase) ? 0.95 : 0.6,
  }));

  const promotionalUrl = descriptionSignals.urls[0] ?? null;
  const discountCode = descriptionSignals.discountCodes[0] ?? null;
  const callToAction = descriptionSignals.callsToAction[0] ?? null;

  // The brand this disclosure actually names: the one inside the disclosure sentence
  // when that is unambiguous, otherwise the sole candidate in the whole description.
  const disclosedBrand =
    brandsInDisclosureContext.length === 1
      ? brandsInDisclosureContext[0]
      : candidateBrands.length === 1
        ? candidateBrands[0]
        : null;

  if (!strongMatch || !disclosedBrand) {
    // No strong, unambiguous disclosure to safely auto-stop on — hand off to Stage 2/3
    // with whatever candidates/evidence were found so they don't have to re-derive it.
    return {
      completed: true,
      shouldStop: false,
      candidateBrands,
      confidenceScore: explicitCommercialSignal ? 0.5 : candidateBrands.length ? 0.2 : 0,
      explicitCommercialSignal,
      evidence: baseEvidence,
      promotionalUrl,
      discountCode,
      callToAction,
      creatorOwnedProduct: false,
      affiliateOnly: !descriptionSignals.hasExplicitSponsorDisclosure && descriptionSignals.discountCodes.length > 0,
      reason: !strongMatch
        ? "No strong, unambiguous sponsorship disclosure found in description/metadata alone."
        : brandsInDisclosureContext.length > 1
          ? `The disclosure names ${brandsInDisclosureContext.length} brands — ambiguous, cannot safely auto-stop without corroboration.`
          : `${candidateBrands.length} candidate brands found and none is named in the disclosure itself — ambiguous, cannot safely auto-stop.`,
      brandName: candidateBrands[0]?.name ?? null,
      brandDomain: candidateBrands[0]?.domain ?? null,
    };
  }

  const brand = disclosedBrand;
  const creatorOwnedProduct = looksCreatorOwned(strongMatch.context);
  const domainMatch = brand.domain !== null;
  const hasCta = descriptionSignals.callsToAction.length > 0 || CTA_PATTERN.test(strongMatch.context);

  if (creatorOwnedProduct) {
    return {
      completed: true,
      shouldStop: false,
      candidateBrands,
      confidenceScore: 0.3,
      explicitCommercialSignal,
      evidence: baseEvidence,
      promotionalUrl,
      discountCode,
      callToAction,
      creatorOwnedProduct: true,
      affiliateOnly: false,
      reason: `"${brand.name}" reads as the creator's own product, not a third-party paid sponsorship — not auto-stopping.`,
      brandName: brand.name,
      brandDomain: brand.domain,
    };
  }

  // Deterministic confidence: a clean, unambiguous, strong disclosure starts at 0.95
  // and can only go up (domain corroboration, a real call-to-action) — never down,
  // since we already required the strongest phrase tier and a single candidate brand.
  let confidenceScore = 0.95;
  if (domainMatch) confidenceScore += 0.02;
  if (hasCta) confidenceScore += 0.02;
  confidenceScore = Math.min(0.99, confidenceScore);

  const shouldStop = confidenceScore >= 0.95;

  return {
    completed: true,
    shouldStop,
    candidateBrands,
    confidenceScore,
    explicitCommercialSignal: true,
    evidence: baseEvidence,
    promotionalUrl,
    discountCode,
    callToAction,
    creatorOwnedProduct: false,
    affiliateOnly: false,
    reason: `Explicit disclosure "${strongMatch.phrase}" clearly names ${brand.name} as this video's sponsor.`,
    brandName: brand.name,
    brandDomain: brand.domain,
  };
}
