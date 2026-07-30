import { prisma } from "@/lib/db";
import { scoreCreatorOpportunity } from "./creator-opportunity";

/**
 * Recomputes rule-based CreatorOpportunity rows for a brand against every monitored
 * channel that does not already have a confirmed sponsorship with that brand.
 */
export async function refreshCreatorOpportunitiesForBrand(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });

  const competitorSuggestions = await prisma.brandCompetitorSuggestion.findMany({ where: { brandId } });
  const competitorBrandNames = competitorSuggestions.map((c) => c.suggestedBrandName);

  const alreadySponsoredChannelIds = new Set(
    (
      await prisma.sponsorshipDetection.findMany({
        where: { brandId, reviewStatus: "CONFIRMED" },
        select: { video: { select: { channelId: true } } },
      })
    ).map((d) => d.video.channelId),
  );

  const channels = await prisma.channel.findMany({
    include: {
      videos: {
        orderBy: { publishedAt: "desc" },
        take: 10,
        include: { sponsorshipDetections: { include: { brand: true } } },
      },
    },
  });

  for (const channel of channels) {
    if (alreadySponsoredChannelIds.has(channel.id)) continue;

    const recentTitles = channel.videos.map((v) => v.title);
    const recentDescriptions = channel.videos.map((v) => v.description);
    const views = channel.videos.map((v) => (v.viewCount !== null ? Number(v.viewCount) : null)).filter((v): v is number => v !== null);
    const averageRecentViews = views.length ? views.reduce((a, b) => a + b, 0) / views.length : null;

    const allDetections = channel.videos.flatMap((v) => v.sponsorshipDetections);
    const pastSponsorCategories = allDetections.map((d) => d.brand?.category ?? null).filter((c): c is string => Boolean(c));
    const pastSponsorBrandNames = allDetections.map((d) => d.brand?.canonicalName ?? d.rawBrandName);

    const result = scoreCreatorOpportunity({
      channelCategory: channel.category,
      recentTitles,
      recentDescriptions,
      brandCategory: brand.category,
      pastSponsorCategories,
      pastSponsorBrandNames,
      competitorBrandNames,
      averageRecentViews,
      subscriberCount: channel.subscriberCount !== null ? Number(channel.subscriberCount) : null,
      sponsoredVideoCount: allDetections.length,
      totalVideosAnalysed: channel.videos.length,
    });

    await prisma.creatorOpportunity.upsert({
      where: { brandId_channelId: { brandId, channelId: channel.id } },
      update: {
        opportunityScore: result.opportunityScore,
        reason: result.reason,
        conflictWarning: result.conflictWarning,
      },
      create: {
        brandId,
        channelId: channel.id,
        opportunityScore: result.opportunityScore,
        reason: result.reason,
        conflictWarning: result.conflictWarning,
      },
    });
  }
}
