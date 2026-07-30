import { domainMatchesBrand, slugifyBrandToken } from "../brand/normalize";
import type { DescriptionSignals } from "../signals/description";
import type { YouTubeMetadataSignals } from "../signals/metadata";
import type { SponsorEvidenceInput } from "../video-analysis/types";
import { isExplicitSpokenStatement, isOnScreenDisclosure } from "./explicit-signal";
import type { ScoringBreakdown } from "./types";

const WEIGHTS = {
  explicitSpokenStatement: 45,
  descriptionDisclosureOrLink: 20,
  onScreenSponsorTextOrLogo: 15,
  transcriptEvidence: 10,
  discountCodeOrCampaignUrl: 5,
  youtubeMetadata: 5,
};

const CONTRADICTION_KEYWORDS = [
  /not sponsor/i,
  /organic (mention|recommendation)/i,
  /no (commercial|sponsorship)/i,
  /just (discussing|comparing)/i,
  /competitor comparison/i,
  /personally use/i,
];

/** Whether evidence text mentions the given brand name (simple case-insensitive containment). */
function mentionsBrand(text: string, brandName: string): boolean {
  return text.toLowerCase().includes(brandName.toLowerCase());
}

function maxStrength(items: SponsorEvidenceInput[]): number {
  return items.length ? Math.max(...items.map((i) => i.strength)) : 0;
}

/**
 * Computes a 0-100 confidence score for a single brand candidate from all accumulated
 * evidence. Not a simple linear sum: each signal category is scaled by the strongest
 * evidence strength observed for that category, cross-source agreement adds a small
 * bonus, contradictory evidence subtracts, and an ambiguous brand identity caps the
 * result below the auto-stop threshold regardless of raw score.
 */
export function scoreBrandCandidate(
  brandName: string,
  brandDomain: string | null,
  evidenceForBrand: SponsorEvidenceInput[],
  descriptionSignals: DescriptionSignals,
  metadataSignals: YouTubeMetadataSignals,
  brandUnambiguous: boolean,
): ScoringBreakdown {
  const explicitEvidence = evidenceForBrand.filter(isExplicitSpokenStatement);
  const onScreenDisclosureEvidence = evidenceForBrand.filter(isOnScreenDisclosure);
  const visualEvidence = evidenceForBrand.filter((e) => e.source === "VIDEO_VISUAL");
  const transcriptOnlyEvidence = evidenceForBrand.filter((e) => e.source === "TRANSCRIPT" && !isExplicitSpokenStatement(e));

  const brandSlug = slugifyBrandToken(brandName);
  const descriptionMentionsBrand = descriptionSignals.candidateBrands.some((c) => slugifyBrandToken(c) === brandSlug);
  const domainFromDescriptionMatches = brandDomain
    ? descriptionSignals.domains.some((d) => domainMatchesBrand(d, brandName))
    : false;
  const descriptionEvidence = evidenceForBrand.filter((e) => e.source === "DESCRIPTION");
  const hasDescriptionSignal =
    (descriptionSignals.hasExplicitSponsorDisclosure && descriptionMentionsBrand) ||
    domainFromDescriptionMatches ||
    descriptionEvidence.length > 0;

  const hasDiscountOrCampaign =
    descriptionSignals.discountCodes.length > 0 ||
    Object.keys(descriptionSignals.campaignParameters).length > 0 ||
    evidenceForBrand.some((e) => typeof e.metadata?.discountCode === "string");

  const explicitSpokenStatement = explicitEvidence.length ? WEIGHTS.explicitSpokenStatement * maxStrength(explicitEvidence) : 0;
  const onScreenSponsorTextOrLogo = onScreenDisclosureEvidence.length
    ? WEIGHTS.onScreenSponsorTextOrLogo * maxStrength(onScreenDisclosureEvidence)
    : visualEvidence.length && visualEvidence.some((e) => mentionsBrand(e.text, brandName))
      ? WEIGHTS.onScreenSponsorTextOrLogo * 0.6 * maxStrength(visualEvidence)
      : 0;
  const descriptionDisclosureOrLink = hasDescriptionSignal
    ? WEIGHTS.descriptionDisclosureOrLink * (domainFromDescriptionMatches ? 1 : Math.max(0.6, maxStrength(descriptionEvidence) || 0.6))
    : 0;
  const transcriptEvidence = transcriptOnlyEvidence.length
    ? WEIGHTS.transcriptEvidence * maxStrength(transcriptOnlyEvidence)
    : 0;
  const discountCodeOrCampaignUrl = hasDiscountOrCampaign ? WEIGHTS.discountCodeOrCampaignUrl : 0;
  const youtubeMetadata = metadataSignals.paidProductPlacement ? WEIGHTS.youtubeMetadata : 0;

  const categoriesMatched = [
    explicitSpokenStatement > 0,
    descriptionDisclosureOrLink > 0,
    onScreenSponsorTextOrLogo > 0,
    transcriptEvidence > 0,
    discountCodeOrCampaignUrl > 0,
    youtubeMetadata > 0,
  ].filter(Boolean).length;

  const agreementAdjustment = categoriesMatched >= 4 ? 15 : categoriesMatched === 3 ? 7 : 0;

  const contradictionMatches = evidenceForBrand.filter((e) => CONTRADICTION_KEYWORDS.some((k) => k.test(e.text)));
  const contradictionPenalty = contradictionMatches.length ? Math.min(35, 15 * contradictionMatches.length) : 0;

  const subtotal =
    explicitSpokenStatement +
    descriptionDisclosureOrLink +
    onScreenSponsorTextOrLogo +
    transcriptEvidence +
    discountCodeOrCampaignUrl +
    youtubeMetadata +
    agreementAdjustment -
    contradictionPenalty;

  const ambiguityCap = brandUnambiguous ? null : 65;
  const capped = ambiguityCap !== null ? Math.min(subtotal, ambiguityCap) : subtotal;
  const rawTotal = Math.max(0, Math.min(100, capped));

  return {
    explicitSpokenStatement,
    descriptionDisclosureOrLink,
    onScreenSponsorTextOrLogo,
    transcriptEvidence,
    discountCodeOrCampaignUrl,
    youtubeMetadata,
    agreementAdjustment,
    contradictionPenalty,
    ambiguityCap,
    rawTotal,
  };
}
