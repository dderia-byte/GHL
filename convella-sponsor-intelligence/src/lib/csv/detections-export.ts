import { buildTimestampedVideoUrl } from "@/lib/youtube/parse";
import { toCsv } from "./csv";

export interface DetectionExportRecord {
  channelName: string;
  channelYoutubeId: string;
  videoTitle: string;
  videoYoutubeId: string;
  publishedAt: Date | null;
  viewCount: number | null;
  brandDisplayName: string | null;
  brandDomain: string | null;
  brandCategory: string | null;
  placementType: string;
  startTimestampSeconds: number | null;
  endTimestampSeconds: number | null;
  evidence: Array<{ source: string; text: string }>;
  confidenceScore: number;
  reviewStatus: string;
  promotionalUrl: string | null;
  discountCode: string | null;
  secondsAnalysed: number;
  chunksProcessed: number;
  stopReason: string | null;
  detectedAt: Date;
}

const HEADERS = [
  "Creator",
  "Channel URL",
  "Video title",
  "Video URL",
  "Publication date",
  "Current views",
  "Brand",
  "Brand domain",
  "Brand category",
  "Placement type",
  "Sponsor timestamp",
  "Sponsor end timestamp",
  "Timestamped video URL",
  "Spoken evidence",
  "Visual evidence",
  "Transcript evidence",
  "Description evidence",
  "Metadata evidence",
  "Confidence score",
  "Review status",
  "Promotional URL",
  "Discount code",
  "Seconds analysed",
  "Chunks processed",
  "Stop reason",
  "Date detected",
];

function evidenceBySource(evidence: DetectionExportRecord["evidence"], source: string): string {
  return evidence
    .filter((e) => e.source === source)
    .map((e) => e.text)
    .join(" | ");
}

/** Builds the sponsor-detections CSV export. Formula-injection-safe (see toCsv). */
export function buildDetectionsCsv(records: DetectionExportRecord[]): string {
  const rows = records.map((r) => ({
    Creator: r.channelName,
    "Channel URL": `https://www.youtube.com/channel/${r.channelYoutubeId}`,
    "Video title": r.videoTitle,
    "Video URL": `https://www.youtube.com/watch?v=${r.videoYoutubeId}`,
    "Publication date": r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : "",
    "Current views": r.viewCount,
    Brand: r.brandDisplayName,
    "Brand domain": r.brandDomain,
    "Brand category": r.brandCategory,
    "Placement type": r.placementType,
    "Sponsor timestamp": r.startTimestampSeconds,
    "Sponsor end timestamp": r.endTimestampSeconds,
    "Timestamped video URL": buildTimestampedVideoUrl(r.videoYoutubeId, r.startTimestampSeconds),
    "Spoken evidence": evidenceBySource(r.evidence, "VIDEO_AUDIO"),
    "Visual evidence": evidenceBySource(r.evidence, "VIDEO_VISUAL"),
    "Transcript evidence": evidenceBySource(r.evidence, "TRANSCRIPT"),
    "Description evidence": evidenceBySource(r.evidence, "DESCRIPTION"),
    "Metadata evidence": evidenceBySource(r.evidence, "YOUTUBE_METADATA"),
    "Confidence score": r.confidenceScore,
    "Review status": r.reviewStatus,
    "Promotional URL": r.promotionalUrl,
    "Discount code": r.discountCode,
    "Seconds analysed": r.secondsAnalysed,
    "Chunks processed": r.chunksProcessed,
    "Stop reason": r.stopReason,
    "Date detected": r.detectedAt.toISOString(),
  }));

  return toCsv(HEADERS, rows);
}
