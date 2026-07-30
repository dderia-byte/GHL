import { prisma } from "@/lib/db";
import type { AnalysisMode } from "@/generated/prisma/enums";
import { enqueueVideoAnalysisJob } from "./queue";

/** Fully restarts analysis for a video from 00:00. */
export async function reanalyseVideo(videoId: string, analysisMode?: AnalysisMode) {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: {
      secondsAnalysed: 0,
      chunksProcessed: 0,
      stopReason: null,
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
