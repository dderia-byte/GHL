import { prisma } from "@/lib/db";
import { ReviewStatus } from "@/generated/prisma/enums";
import type { DetectionExportRecord } from "./detections-export";

async function toExportRecords(
  detections: Array<{
    id: string;
    rawBrandName: string;
    placementType: string;
    startTimestampSeconds: number | null;
    endTimestampSeconds: number | null;
    confidenceScore: number;
    reviewStatus: string;
    promotionalUrl: string | null;
    discountCode: string | null;
    createdAt: Date;
    brand: { displayName: string; domain: string | null; category: string | null } | null;
    evidence: Array<{ source: string; text: string }>;
    video: {
      title: string;
      youtubeVideoId: string;
      publishedAt: Date | null;
      viewCount: bigint | null;
      secondsAnalysed: number;
      chunksProcessed: number;
      stopReason: string | null;
      channel: { name: string; youtubeChannelId: string };
    };
  }>,
): Promise<DetectionExportRecord[]> {
  return detections.map((d) => ({
    channelName: d.video.channel.name,
    channelYoutubeId: d.video.channel.youtubeChannelId,
    videoTitle: d.video.title,
    videoYoutubeId: d.video.youtubeVideoId,
    publishedAt: d.video.publishedAt,
    viewCount: d.video.viewCount !== null ? Number(d.video.viewCount) : null,
    brandDisplayName: d.brand?.displayName ?? d.rawBrandName,
    brandDomain: d.brand?.domain ?? null,
    brandCategory: d.brand?.category ?? null,
    placementType: d.placementType,
    startTimestampSeconds: d.startTimestampSeconds,
    endTimestampSeconds: d.endTimestampSeconds,
    evidence: d.evidence,
    confidenceScore: d.confidenceScore,
    reviewStatus: d.reviewStatus,
    promotionalUrl: d.promotionalUrl,
    discountCode: d.discountCode,
    secondsAnalysed: d.video.secondsAnalysed,
    chunksProcessed: d.video.chunksProcessed,
    stopReason: d.video.stopReason,
    detectedAt: d.createdAt,
  }));
}

const INCLUDE = {
  brand: true,
  evidence: true,
  video: { include: { channel: true } },
} as const;

export async function getChannelExportRecords(channelId: string): Promise<DetectionExportRecord[]> {
  const detections = await prisma.sponsorshipDetection.findMany({
    where: { video: { channelId } },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return toExportRecords(detections);
}

export async function getBrandExportRecords(brandId: string): Promise<DetectionExportRecord[]> {
  const detections = await prisma.sponsorshipDetection.findMany({
    where: { brandId },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return toExportRecords(detections);
}

export async function getAllExportRecords(reviewStatus?: string): Promise<DetectionExportRecord[]> {
  const validStatus = reviewStatus && reviewStatus in ReviewStatus ? (reviewStatus as ReviewStatus) : undefined;
  const detections = await prisma.sponsorshipDetection.findMany({
    where: validStatus ? { reviewStatus: validStatus } : undefined,
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return toExportRecords(detections);
}
