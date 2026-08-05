import { getEnv, hasGeminiCredentials } from "@/lib/env";
import { GeminiVideoAnalysisProvider } from "./providers/gemini";
import { MockVideoAnalysisProvider } from "./providers/mock";
import type { VideoAnalysisProvider } from "./types";

export * from "./types";
export { GeminiVideoAnalysisProvider } from "./providers/gemini";
export { MockVideoAnalysisProvider, DEFAULT_MOCK_SCRIPT } from "./providers/mock";

/**
 * Resolves the configured video-analysis provider. Falls back to the mock provider
 * (clearly marked via `.name === "mock"`) when Gemini credentials are not configured,
 * so local development and CI never require real API keys.
 */
export function getVideoAnalysisProvider(): VideoAnalysisProvider {
  const env = getEnv();
  if (env.VIDEO_ANALYSIS_PROVIDER === "mock") return new MockVideoAnalysisProvider();
  if (!hasGeminiCredentials()) return new MockVideoAnalysisProvider();
  return new GeminiVideoAnalysisProvider();
}
