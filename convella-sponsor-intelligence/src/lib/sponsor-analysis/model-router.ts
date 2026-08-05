import { getCheapTextModel, getReasoningModel, getEnv } from "@/lib/env";
import type { ModelRouter } from "./types";

/**
 * Central place model choice is decided, so a premium reasoning model never
 * accidentally gets used for cheap Stage 2 classification (or vice versa).
 */
export function createModelRouter(): ModelRouter {
  return {
    getTranscriptModel: () => getCheapTextModel(),
    getReasoningModel: () => getReasoningModel(),
    getVideoModel: () => getEnv().GEMINI_VIDEO_MODEL,
  };
}
