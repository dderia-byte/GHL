import { z } from "zod";
import type { TranscriptSegmentInput } from "../transcript/types";

export interface VideoChunk {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  /**
   * Reference to authorised media for this chunk (e.g. a Gemini Files API URI for
   * media the operator has uploaded with permission, or empty when no authorised
   * media is available). This system never downloads YouTube video/audio itself.
   */
  mediaReference: string;
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
});
