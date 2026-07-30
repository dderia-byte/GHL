/**
 * Rough, clearly-labelled cost estimates (USD) for dashboard/reporting purposes only —
 * not a billing-accurate figure. Real per-token/per-second pricing varies by provider,
 * model and media length; these constants intentionally err on the side of a simple,
 * explainable estimate rather than a false precision.
 */
const TEXT_ONLY_CHUNK_COST = 0.001;
const AUTHORISED_MEDIA_CHUNK_COST = 0.01;
const CLASSIFICATION_CALL_COST = 0.003;

export function estimateChunkCost(hasAuthorisedMedia: boolean): number {
  return hasAuthorisedMedia ? AUTHORISED_MEDIA_CHUNK_COST : TEXT_ONLY_CHUNK_COST;
}

export function estimateClassificationCost(): number {
  return CLASSIFICATION_CALL_COST;
}
