import { analyseDescription } from "@/lib/signals/description";

export interface PromotionalSignalsResult {
  hasPromotionalSignals: boolean;
  /** Which signal classes matched — persisted on the candidate for auditability. */
  matchedClasses: string[];
}

/**
 * The free, deterministic "does this unsponsored video show commercial intent?"
 * predicate (spec §5.3) that decides whether a creator earns a second-video
 * analysis. Deliberately permissive: a false positive costs one extra cheap
 * analysis, a false negative costs a potentially valuable creator. Never calls a
 * model — it runs on every unsponsored newest video.
 */
export function detectPromotionalSignals(input: {
  description: string;
  paidProductPlacement: boolean;
}): PromotionalSignalsResult {
  const signals = analyseDescription(input.description);
  const matchedClasses: string[] = [];

  if (signals.discountCodes.length > 0) matchedClasses.push("discount-codes");
  if (signals.hasExplicitSponsorDisclosure) matchedClasses.push("disclosure-phrases");
  if (signals.disclosureMatches.some((m) => m.phrase.includes("affiliate"))) matchedClasses.push("affiliate-disclosure");
  if (Object.keys(signals.campaignParameters).length > 0) matchedClasses.push("campaign-parameters");
  if (signals.candidateBrands.length > 0) matchedClasses.push("brand-mentions");
  if (signals.callsToAction.length > 0 && signals.urls.length > 0) matchedClasses.push("cta-with-links");
  if (input.paidProductPlacement) matchedClasses.push("paid-product-placement-flag");

  return { hasPromotionalSignals: matchedClasses.length > 0, matchedClasses };
}
