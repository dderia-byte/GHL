import { domainMatchesBrand, slugifyBrandToken } from "../brand/normalize";
import type { DescriptionSignals } from "../signals/description";
import type { YouTubeMetadataSignals } from "../signals/metadata";
import type { SponsorEvidenceInput } from "../video-analysis/types";
import { isExplicitSpokenStatement, isOnScreenDisclosure } from "./explicit-signal";
import { scoreBrandCandidate } from "./scoring";
import type { DecisionEngineInput, DecisionEvaluation } from "./types";

const CTA_PATTERN = /try |use the link|sign up|check out|special offer|free trial/i;

function mentionsBrand(text: string, brandName: string): boolean {
  return text.toLowerCase().includes(brandName.toLowerCase());
}

function isBrandUnambiguous(
  brandName: string,
  brandDomain: string | null,
  evidenceForBrand: SponsorEvidenceInput[],
  descriptionSignals: DescriptionSignals,
): boolean {
  const hasDomain = Boolean(brandDomain) || descriptionSignals.domains.some((d) => domainMatchesBrand(d, brandName));
  const hasExplicitPhraseNamingBrand = evidenceForBrand.some(
    (e) => isExplicitSpokenStatement(e) && mentionsBrand(e.text, brandName),
  );
  return hasDomain || hasExplicitPhraseNamingBrand;
}

function hasExplicitCommercialSignal(
  brandName: string,
  evidenceForBrand: SponsorEvidenceInput[],
  descriptionSignals: DescriptionSignals,
  metadataSignals: YouTubeMetadataSignals,
  recognisedThisRound: boolean,
): boolean {
  if (evidenceForBrand.some(isExplicitSpokenStatement)) return true;
  if (evidenceForBrand.some(isOnScreenDisclosure)) return true;
  if (metadataSignals.paidProductPlacement) return true;

  const brandSlug = slugifyBrandToken(brandName);
  const descriptionMentionsBrand = descriptionSignals.candidateBrands.some((c) => slugifyBrandToken(c) === brandSlug);
  const hasCta = descriptionSignals.callsToAction.length > 0 || evidenceForBrand.some((e) => CTA_PATTERN.test(e.text));

  if (descriptionMentionsBrand && descriptionSignals.hasExplicitSponsorDisclosure && hasCta) return true;
  if (recognisedThisRound && descriptionSignals.discountCodes.length > 0) return true;
  if (recognisedThisRound && Object.keys(descriptionSignals.campaignParameters).length > 0) return true;

  return false;
}

function notStopping(): DecisionEvaluation {
  return {
    shouldStop: false,
    createDetection: false,
    brandName: null,
    brandDomain: null,
    confidenceScore: 0,
    sponsorshipConfirmed: false,
    explicitSignalPresent: false,
    brandUnambiguous: false,
    startTimestampSeconds: null,
    endTimestampSeconds: null,
    primaryEvidenceText: "",
    primaryEvidenceSource: "TRANSCRIPT",
    scoring: {
      explicitSpokenStatement: 0,
      descriptionDisclosureOrLink: 0,
      onScreenSponsorTextOrLogo: 0,
      transcriptEvidence: 0,
      discountCodeOrCampaignUrl: 0,
      youtubeMetadata: 0,
      agreementAdjustment: 0,
      contradictionPenalty: 0,
      ambiguityCap: null,
      rawTotal: 0,
    },
  };
}

/**
 * The sponsorship decision engine. Called once per analysed chunk (after the chunk's
 * evidence has been appended to `accumulatedEvidence`). Applies the strict stopping
 * condition: recognised === true AND confidence >= 0.90 AND an explicit commercial
 * signal exists AND the brand identity is unambiguous. Never stops on a bare
 * logo/product mention alone.
 */
export function evaluateSponsorshipDecision(input: DecisionEngineInput): DecisionEvaluation {
  const { chunkResult, accumulatedEvidence, descriptionSignals, metadataSignals } = input;

  if (!chunkResult.brandName) return notStopping();

  const brandName = chunkResult.brandName;
  const brandDomain = chunkResult.brandDomain;

  const evidenceForBrand = accumulatedEvidence.filter((e) => mentionsBrand(e.text, brandName));
  const effectiveEvidence = evidenceForBrand.length ? evidenceForBrand : chunkResult.evidence;

  const brandUnambiguous = isBrandUnambiguous(brandName, brandDomain, effectiveEvidence, descriptionSignals);
  const scoring = scoreBrandCandidate(
    brandName,
    brandDomain,
    effectiveEvidence,
    descriptionSignals,
    metadataSignals,
    brandUnambiguous,
  );
  const confidenceScore = Math.round(scoring.rawTotal) / 100;

  const explicitSignalPresent = hasExplicitCommercialSignal(
    brandName,
    effectiveEvidence,
    descriptionSignals,
    metadataSignals,
    chunkResult.recognised,
  );

  const shouldStop = chunkResult.recognised && confidenceScore >= 0.9 && explicitSignalPresent && brandUnambiguous;
  const createDetection = confidenceScore >= 0.25;

  const sortedByStrength = [...effectiveEvidence].sort((a, b) => b.strength - a.strength);
  const primary = sortedByStrength[0];

  const timestamps = effectiveEvidence
    .map((e) => e.timestampSeconds)
    .filter((t): t is number => t !== null && t !== undefined);

  const startTimestampSeconds = timestamps.length ? Math.min(...timestamps) : chunkResult.startTimestampSeconds;
  const endTimestampSeconds = chunkResult.endTimestampSeconds ?? (timestamps.length ? Math.max(...timestamps) : null);

  return {
    shouldStop,
    createDetection,
    brandName,
    brandDomain,
    confidenceScore,
    sponsorshipConfirmed: shouldStop,
    explicitSignalPresent,
    brandUnambiguous,
    startTimestampSeconds,
    endTimestampSeconds,
    primaryEvidenceText: primary?.text ?? chunkResult.reason,
    primaryEvidenceSource: primary?.source ?? "TRANSCRIPT",
    scoring,
  };
}
