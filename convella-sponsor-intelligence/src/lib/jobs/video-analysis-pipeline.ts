import { runSponsorAnalysisPipeline, type SponsorAnalysisOptions } from "@/lib/sponsor-analysis/pipeline";
import type { AnalysisMode } from "@/generated/prisma/enums";

export interface RunVideoAnalysisOptions {
  /** Overrides the video's stored analysis mode for this run only. */
  forceMode?: AnalysisMode;
  /** Bypasses hash-based stage reuse and re-runs the full three-stage pipeline even if description/transcript content hasn't changed. */
  forceFullReanalysis?: boolean;
}

/**
 * Thin, backward-compatible entry point kept so `scripts/worker.ts` and existing
 * imports don't need to change — the real sequential-chunk pipeline this used to
 * contain has been replaced by the three-stage cost-optimised pipeline in
 * `src/lib/sponsor-analysis/pipeline.ts` (free deterministic description/metadata
 * analysis, then targeted transcript windows with a cheap model only if needed, then
 * targeted native-video Gemini windows only if still needed).
 */
export async function runVideoAnalysis(jobId: string, videoId: string, options: RunVideoAnalysisOptions = {}) {
  const sponsorAnalysisOptions: SponsorAnalysisOptions = {
    forceMode: options.forceMode,
    forceFullReanalysis: options.forceFullReanalysis,
  };
  await runSponsorAnalysisPipeline(jobId, videoId, sponsorAnalysisOptions);
}
