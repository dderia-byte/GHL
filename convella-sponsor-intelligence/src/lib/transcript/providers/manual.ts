import type { TranscriptProvider, TranscriptResult } from "../types";
import { parseTxt } from "../parsers/txt";

/**
 * Wraps a transcript the user pasted directly into the UI. The video ID is accepted
 * to satisfy the TranscriptProvider contract but is not used for lookup — the text
 * was already supplied by the caller.
 */
export class ManualTranscriptProvider implements TranscriptProvider {
  readonly name = "manual";

  constructor(private readonly pastedText: string) {}

  async getTranscript(_videoId: string): Promise<TranscriptResult> {
    const text = this.pastedText.trim();
    if (!text) {
      return { status: "UNAVAILABLE", source: this.name, segments: [], fullText: "" };
    }
    const segments = parseTxt(text);
    return {
      status: "AVAILABLE",
      source: this.name,
      segments,
      fullText: segments.map((s) => s.text).join(" "),
    };
  }
}
