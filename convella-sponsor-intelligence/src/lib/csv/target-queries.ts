import { prisma } from "@/lib/db";

/**
 * Data assembly for the outreach-targeting CSV exports. A detection "counts" as a
 * sponsorship signal unless a human explicitly ruled it out (REJECTED) or marked it
 * organic — pending detections are included but reported separately from confirmed
 * ones so the spreadsheet user can filter on certainty themselves.
 */
const COUNTED_REVIEW_STATUSES = ["PENDING", "CONFIRMED", "EDITED"] as const;

export interface CreatorTargetRecord {
  channelName: string;
  channelYoutubeId: string;
  handle: string | null;
  subscriberCount: bigint | null;
  niche: string | null;
  source: string; // "manual" | "discovery"
  discoveredAt: Date | null;
  videosAnalysed: number;
  sponsoredVideos: number;
  detections: Array<{
    brandName: string;
    brandDomain: string | null;
    brandCategory: string | null;
    placementType: string;
    reviewStatus: string;
    confidenceScore: number;
    discountCode: string | null;
    videoYoutubeId: string;
    videoTitle: string;
    videoPublishedAt: Date | null;
    detectedAt: Date;
  }>;
}

export async function getCreatorTargetRecords(): Promise<CreatorTargetRecord[]> {
  const channels = await prisma.channel.findMany({
    where: {
      videos: { some: { sponsorshipDetections: { some: { reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } } } } },
    },
    include: {
      videos: {
        select: {
          youtubeVideoId: true,
          title: true,
          publishedAt: true,
          analysisStatus: true,
          sponsorshipDetections: {
            where: { reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } },
            include: { brand: { select: { displayName: true, domain: true, category: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return channels.map((channel) => {
    const analysedStatuses = ["SPONSOR_FOUND", "NO_SPONSOR_FOUND", "PARTIAL", "HUMAN_REVIEW_REQUIRED"];
    const videosAnalysed = channel.videos.filter((v) => analysedStatuses.includes(v.analysisStatus)).length;
    const sponsoredVideos = channel.videos.filter((v) => v.sponsorshipDetections.length > 0).length;

    const detections = channel.videos.flatMap((video) =>
      video.sponsorshipDetections.map((d) => ({
        brandName: d.brand?.displayName ?? d.rawBrandName,
        brandDomain: d.brand?.domain ?? null,
        brandCategory: d.brand?.category ?? null,
        placementType: d.placementType,
        reviewStatus: d.reviewStatus,
        confidenceScore: d.confidenceScore,
        discountCode: d.discountCode,
        videoYoutubeId: video.youtubeVideoId,
        videoTitle: video.title,
        videoPublishedAt: video.publishedAt,
        detectedAt: d.createdAt,
      })),
    );

    return {
      channelName: channel.name,
      channelYoutubeId: channel.youtubeChannelId,
      handle: channel.handle,
      subscriberCount: channel.subscriberCount,
      niche: channel.niche ?? channel.category,
      source: channel.discoverySource ?? "manual",
      discoveredAt: channel.discoveredAt,
      videosAnalysed,
      sponsoredVideos,
      detections,
    };
  });
}

export interface BrandTargetRecord {
  brandName: string;
  brandDomain: string | null;
  brandCategory: string | null;
  competitorSuggestions: string[];
  detections: Array<{
    channelName: string;
    channelYoutubeId: string;
    subscriberCount: bigint | null;
    channelSource: string;
    placementType: string;
    reviewStatus: string;
    confidenceScore: number;
    discountCode: string | null;
    videoYoutubeId: string;
    videoTitle: string;
    detectedAt: Date;
  }>;
}

export async function getBrandTargetRecords(): Promise<BrandTargetRecord[]> {
  const brands = await prisma.brand.findMany({
    where: { sponsorshipDetections: { some: { reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } } } },
    include: {
      competitorSuggestions: { select: { suggestedBrandName: true }, take: 5 },
      sponsorshipDetections: {
        where: { reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } },
        include: {
          video: {
            select: {
              youtubeVideoId: true,
              title: true,
              channel: {
                select: { name: true, youtubeChannelId: true, subscriberCount: true, discoverySource: true },
              },
            },
          },
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  return brands.map((brand) => ({
    brandName: brand.displayName,
    brandDomain: brand.domain,
    brandCategory: brand.category,
    competitorSuggestions: brand.competitorSuggestions.map((s) => s.suggestedBrandName),
    detections: brand.sponsorshipDetections.map((d) => ({
      channelName: d.video.channel.name,
      channelYoutubeId: d.video.channel.youtubeChannelId,
      subscriberCount: d.video.channel.subscriberCount,
      channelSource: d.video.channel.discoverySource ?? "manual",
      placementType: d.placementType,
      reviewStatus: d.reviewStatus,
      confidenceScore: d.confidenceScore,
      discountCode: d.discountCode,
      videoYoutubeId: d.video.youtubeVideoId,
      videoTitle: d.video.title,
      detectedAt: d.createdAt,
    })),
  }));
}
