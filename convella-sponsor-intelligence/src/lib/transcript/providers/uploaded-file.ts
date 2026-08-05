import type { TranscriptProvider, TranscriptResult } from "../types";
import { parseSrt } from "../parsers/srt";
import { parseVtt } from "../parsers/vtt";
import { parseTxt } from "../parsers/txt";

export type UploadedTranscriptFormat = "srt" | "vtt" | "txt";

const PARSERS: Record<UploadedTranscriptFormat, (content: string) => ReturnType<typeof parseTxt>> = {
  srt: parseSrt,
  vtt: parseVtt,
  txt: parseTxt,
};

export function detectTranscriptFormat(filename: string): UploadedTranscriptFormat | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "srt" || ext === "vtt" || ext === "txt") return ext;
  return null;
}

/** Wraps a user-uploaded .srt / .vtt / .txt transcript file the user is authorised to process. */
export class UploadedFileTranscriptProvider implements TranscriptProvider {
  readonly name = "uploaded_file";

  constructor(
    private readonly fileContent: string,
    private readonly format: UploadedTranscriptFormat,
  ) {}

  async getTranscript(_videoId: string): Promise<TranscriptResult> {
    const parse = PARSERS[this.format];
    const segments = parse(this.fileContent);

    if (segments.length === 0) {
      return { status: "FAILED", source: this.name, segments: [], fullText: "" };
    }

    return {
      status: "AVAILABLE",
      source: `uploaded_file:${this.format}`,
      segments,
      fullText: segments.map((s) => s.text).join(" "),
    };
  }
}
