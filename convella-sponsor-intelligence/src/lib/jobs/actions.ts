import { prisma } from "@/lib/db";
import type { AnalysisMode } from "@/generated/prisma/enums";
import { enqueueVideoAnalysisJob } from "./queue";

/**
 * Fully restarts the three-stage pipeline for a video. Clears `resolvedAtStage` so the
 * pipeline's hash-based reuse check (which otherwise skips re-running an unchanged,
 * already-resolved video for free) can't short-circuit this explicit request — an
 * operator asking to reanalyse always gets a real, fresh run.
 */
export async function reanalyseVideo(videoId: string, analysisMode?: AnalysisMode) {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: {
      secondsAnalysed: 0,
      chunksProcessed: 0,
      stopReason: null,
      resolvedAtStage: null,
      analysisStatus: "QUEUED",
      ...(analysisMode ? { analysisMode } : {}),
    },
  });
  return enqueueVideoAnalysisJob(videoId, analysisMode ?? video.analysisMode);
}

/**
 * Resumes analysis past the point where FIRST_SPONSOR_ONLY mode stopped, looking for
 * additional sponsors for the remainder of the video without re-watching what was
 * already analysed.
 */
export async function continueAnalysisAfterFirstSponsor(videoId: string) {
  return enqueueVideoAnalysisJob(videoId, "ALL_SPONSORS");
}
