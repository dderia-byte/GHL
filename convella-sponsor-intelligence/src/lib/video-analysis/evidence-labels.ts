import type { ChunkEvidenceSource } from "./types";

/** Human-readable label for an evidence source, used anywhere evidence is shown to a reviewer. */
export function describeEvidenceSource(source: ChunkEvidenceSource): string {
  switch (source) {
    case "VIDEO_AUDIO":
      return "Heard in original audio";
    case "VIDEO_VISUAL":
      return "Seen in video";
    case "TRANSCRIPT":
      return "Found in transcript";
    case "DESCRIPTION":
      return "Found in description";
    case "YOUTUBE_METADATA":
      return "Found in YouTube metadata";
  }
}
