import { z } from "zod";
import type { TranscriptSegmentInput } from "../transcript/types";

/**
 * How this chunk's real audio/visual content, if any, should be supplied to the video
 * analysis provider.
 *
 * - `YOUTUBE_URL`: the video's own public `youtube.com/watch?v=...` URL, passed
 *   directly to Gemini as native video input. Gemini fetches and decodes it itself —
 *   Convella never downloads or scrapes the video/audio. Only works for public videos.
 * - `GEMINI_FILE` / `LOCAL_UPLOAD`: an operator-supplied file (e.g. for a private or
 *   unlisted video, or any other legitimately obtained raw file) that has already been
 *   uploaded to Gemini's Files API, or exists on disk locally.
 *
 * `null` (no reference at all) means no real media is available for this chunk —
 * analysis falls back to transcript/description text only, and must be labelled as such.
 */
export type MediaReference =
  | { type: "YOUTUBE_URL"; url: string }
  | { type: "GEMINI_FILE"; uri: string; mimeType: string }
  | { type: "LOCAL_UPLOAD"; path: string; mimeType: string };

export interface VideoChunk {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  mediaReference: MediaReference | null;
}

export const evidenceSourceValues = [
  "VIDEO_AUDIO",
  "VIDEO_VISUAL",
  "TRANSCRIPT",
  "DESCRIPTION",
  "YOUTUBE_METADATA",
] as const;

export type ChunkEvidenceSource = (typeof evidenceSourceValues)[number];

export interface SponsorEvidenceInput {
  source: ChunkEvidenceSource;
  timestampSeconds: number | null;
  text: string;
  strength: number;
  metadata?: Record<string, unknown>;
}

export const mediaSourceMethodValues = ["YOUTUBE_URL", "GEMINI_FILE", "LOCAL_UPLOAD", "NONE"] as const;
export type MediaSourceMethod = (typeof mediaSourceMethodValues)[number];

/**
 * What was actually analysed for a chunk. Built by the provider after cross-checking
 * the model's own self-reported flags against the provider's server-side facts (e.g.
 * Gemini's per-modality token usage) — never taken from the model's text output alone,
 * since a model can claim to have watched a video it was never actually given.
 */
export interface AnalysisInputsUsed {
  mediaSourceMethod: MediaSourceMethod;
  videoInputAnalysed: boolean;
  nativeAudioAnalysed: boolean;
  visualFramesAnalysed: boolean;
  transcriptProvided: boolean;
  descriptionProvided: boolean;
  model: string;
  providerError: string | null;
}

export interface SponsorRecognitionResult {
  recognised: boolean;
  brandName: string | null;
  brandDomain: string | null;
  placementType: string | null;
  sponsorshipConfirmed: boolean;
  confidenceScore: number;
  startTimestampSeconds: number | null;
  endTimestampSeconds: number | null;
  evidence: SponsorEvidenceInput[];
  reason: string;
  analysisInputs: AnalysisInputsUsed;
}

export interface VideoAnalysisContext {
  title: string;
  description: string;
  transcriptSegments: TranscriptSegmentInput[];
  previousObservations: SponsorEvidenceInput[];
  candidateBrands: string[];
  /** True when confidence is 0.70-0.89 or a possible logo/URL could not be identified clearly. */
  requestTargetedFrameAnalysis?: boolean;
}

export interface VideoAnalysisProvider {
  readonly name: string;
  analyseChunk(chunk: VideoChunk, context: VideoAnalysisContext): Promise<SponsorRecognitionResult>;
}

export const sponsorEvidenceInputSchema = z.object({
  source: z.enum(evidenceSourceValues),
  timestampSeconds: z.number().int().nullable(),
  text: z.string().min(1).max(2000),
  strength: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for the raw JSON the model itself returns — flat self-reported modality
 * flags plus the usual recognition fields. This is deliberately NOT trusted as-is: the
 * Gemini provider cross-validates videoInputAnalysed/nativeAudioAnalysed/
 * visualFramesAnalysed against real server-side usage metadata before building the
 * final, authoritative `AnalysisInputsUsed`.
 */
export const geminiChunkRawResponseSchema = z.object({
  videoInputAnalysed: z.boolean(),
  nativeAudioAnalysed: z.boolean(),
  visualFramesAnalysed: z.boolean(),
  recognised: z.boolean(),
  brandName: z.string().nullable(),
  brandDomain: z.string().nullable(),
  placementType: z.string().nullable(),
  sponsorshipConfirmed: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  startTimestampSeconds: z.number().int().nullable(),
  endTimestampSeconds: z.number().int().nullable(),
  evidence: z.array(sponsorEvidenceInputSchema),
  reason: z.string().min(1).max(4000),
});

export const analysisInputsUsedSchema = z.object({
  mediaSourceMethod: z.enum(mediaSourceMethodValues),
  videoInputAnalysed: z.boolean(),
  nativeAudioAnalysed: z.boolean(),
  visualFramesAnalysed: z.boolean(),
  transcriptProvided: z.boolean(),
  descriptionProvided: z.boolean(),
  model: z.string(),
  providerError: z.string().nullable(),
});

export const sponsorRecognitionResultSchema = z.object({
  recognised: z.boolean(),
  brandName: z.string().nullable(),
  brandDomain: z.string().nullable(),
  placementType: z.string().nullable(),
  sponsorshipConfirmed: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  startTimestampSeconds: z.number().int().nullable(),
  endTimestampSeconds: z.number().int().nullable(),
  evidence: z.array(sponsorEvidenceInputSchema),
  reason: z.string().min(1).max(4000),
  analysisInputs: analysisInputsUsedSchema,
});
