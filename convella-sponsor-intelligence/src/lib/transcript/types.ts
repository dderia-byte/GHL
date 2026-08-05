export interface TranscriptSegmentInput {
  text: string;
  startSeconds: number | null;
  durationSeconds: number | null;
}

export type TranscriptResultStatus = "AVAILABLE" | "UNAVAILABLE" | "FAILED";

export interface TranscriptResult {
  status: TranscriptResultStatus;
  source: string;
  language?: string;
  segments: TranscriptSegmentInput[];
  fullText: string;
}

export interface TranscriptProvider {
  /** Human-readable identifier stored as Video.transcriptSource. */
  readonly name: string;
  getTranscript(videoId: string): Promise<TranscriptResult>;
}
