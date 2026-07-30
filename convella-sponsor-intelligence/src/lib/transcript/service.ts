import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { ManualTranscriptProvider } from "./providers/manual";
import { UploadedFileTranscriptProvider, type UploadedTranscriptFormat } from "./providers/uploaded-file";
import { MockTranscriptProvider } from "./providers/mock";
import type { TranscriptResult } from "./types";

async function persistTranscript(videoId: string, result: TranscriptResult): Promise<TranscriptResult> {
  await prisma.$transaction([
    prisma.transcriptSegment.deleteMany({ where: { videoId } }),
    prisma.video.update({
      where: { id: videoId },
      data: {
        transcriptStatus: result.status,
        transcriptSource: result.source,
        transcriptText: result.fullText || null,
      },
    }),
    ...(result.segments.length
      ? [
          prisma.transcriptSegment.createMany({
            data: result.segments.map((s) => ({
              videoId,
              startSeconds: s.startSeconds,
              durationSeconds: s.durationSeconds,
              text: s.text,
              source: result.source,
            })),
          }),
        ]
      : []),
  ]);
  return result;
}

/** Ingests a user-pasted transcript for a video (Video.id, not the YouTube video ID). */
export async function ingestPastedTranscript(videoId: string, pastedText: string): Promise<TranscriptResult> {
  const provider = new ManualTranscriptProvider(pastedText);
  const result = await provider.getTranscript(videoId);
  return persistTranscript(videoId, result);
}

/** Ingests an uploaded .srt/.vtt/.txt transcript file for a video the user is authorised to process. */
export async function ingestUploadedTranscript(
  videoId: string,
  fileContent: string,
  format: UploadedTranscriptFormat,
): Promise<TranscriptResult> {
  const provider = new UploadedFileTranscriptProvider(fileContent, format);
  const result = await provider.getTranscript(videoId);
  return persistTranscript(videoId, result);
}

/**
 * Resolves the transcript to use for analysis: prefers whatever is already stored
 * (from a manual paste or file upload), otherwise falls back to the mock provider in
 * development, otherwise marks the video as requiring a manual upload and continues
 * the analysis job without a transcript.
 */
export async function ensureTranscriptForAnalysis(videoId: string): Promise<TranscriptResult> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  if (video.transcriptStatus === "AVAILABLE") {
    const segments = await prisma.transcriptSegment.findMany({ where: { videoId }, orderBy: { startSeconds: "asc" } });
    return {
      status: "AVAILABLE",
      source: video.transcriptSource ?? "stored",
      segments: segments.map((s) => ({ text: s.text, startSeconds: s.startSeconds, durationSeconds: s.durationSeconds })),
      fullText: video.transcriptText ?? segments.map((s) => s.text).join(" "),
    };
  }

  const env = getEnv();
  if (env.TRANSCRIPT_PROVIDER === "mock") {
    const provider = new MockTranscriptProvider();
    const result = await provider.getTranscript(video.youtubeVideoId);
    return persistTranscript(videoId, result);
  }

  await prisma.video.update({ where: { id: videoId }, data: { transcriptStatus: "MANUAL_UPLOAD_REQUIRED" } });
  return { status: "UNAVAILABLE", source: "none", segments: [], fullText: "" };
}
