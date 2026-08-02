import { getEnv } from "@/lib/env";

/**
 * Rough, clearly-labelled cost estimates (USD) for dashboard/reporting and guardrail
 * purposes only — not a billing-accurate figure. Real per-token/per-second pricing
 * varies by provider, model and video length; these constants intentionally err on the
 * side of a simple, explainable estimate rather than false precision.
 */
const CHEAP_TEXT_INPUT_COST_PER_1K_TOKENS = 0.001;
const CHEAP_TEXT_OUTPUT_COST_PER_1K_TOKENS = 0.005;
const REASONING_INPUT_COST_PER_1K_TOKENS = 0.003;
const REASONING_OUTPUT_COST_PER_1K_TOKENS = 0.015;
/** Rough $/second of native video analysed — derived from observed Gemini video-token usage (~5,100 tokens per 60s window). */
const VIDEO_SECOND_COST = 0.0004;

export function estimateTextModelCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * CHEAP_TEXT_INPUT_COST_PER_1K_TOKENS + (outputTokens / 1000) * CHEAP_TEXT_OUTPUT_COST_PER_1K_TOKENS;
}

export function estimateReasoningModelCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * REASONING_INPUT_COST_PER_1K_TOKENS + (outputTokens / 1000) * REASONING_OUTPUT_COST_PER_1K_TOKENS;
}

export function estimateVideoModelCost(seconds: number): number {
  return seconds * VIDEO_SECOND_COST;
}

export interface Stage3Progress {
  callsMade: number;
  secondsAnalysed: number;
  estimatedCostSoFar: number;
}

export interface CostLimitCheck {
  allowed: boolean;
  reason: string | null;
}

/**
 * Checked before every Stage 3 Gemini call. Blocks the call (rather than making it and
 * discovering the overage afterward) whenever the *next* window would push calls,
 * seconds, or estimated dollar spend past the configured per-video limits.
 */
export function checkStage3CostLimits(progress: Stage3Progress, nextWindowSeconds: number): CostLimitCheck {
  const env = getEnv();

  if (progress.callsMade + 1 > env.MAX_NATIVE_VIDEO_CALLS_PER_VIDEO) {
    return { allowed: false, reason: `Reached the maximum of ${env.MAX_NATIVE_VIDEO_CALLS_PER_VIDEO} native video calls for this video.` };
  }
  if (progress.secondsAnalysed + nextWindowSeconds > env.MAX_NATIVE_VIDEO_SECONDS_PER_VIDEO) {
    return { allowed: false, reason: `Reached the maximum of ${env.MAX_NATIVE_VIDEO_SECONDS_PER_VIDEO} native video seconds for this video.` };
  }
  const projectedCost = progress.estimatedCostSoFar + estimateVideoModelCost(nextWindowSeconds);
  if (projectedCost > env.MAX_ESTIMATED_COST_PER_VIDEO_USD) {
    return {
      allowed: false,
      reason: `The next native video call would push estimated spend to $${projectedCost.toFixed(4)}, above the $${env.MAX_ESTIMATED_COST_PER_VIDEO_USD.toFixed(2)} per-video limit.`,
    };
  }
  return { allowed: true, reason: null };
}
