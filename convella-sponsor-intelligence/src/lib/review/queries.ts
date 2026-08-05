import { prisma } from "@/lib/db";

function commercialRelevanceScore(d: { promotionalUrl: string | null; discountCode: string | null; callToAction: string | null }): number {
  return (d.promotionalUrl ? 1 : 0) + (d.discountCode ? 1 : 0) + (d.callToAction ? 1 : 0);
}

/**
 * Review queue ordering: high commercial relevance first, then lower confidence
 * (needs more scrutiny), then most recent publication date, then highest view count.
 */
export async function getReviewQueue() {
  const pending = await prisma.sponsorshipDetection.findMany({
    where: { reviewStatus: "PENDING" },
    include: { brand: true, video: { include: { channel: true } } },
  });

  return pending.sort((a, b) => {
    const relevanceDiff = commercialRelevanceScore(b) - commercialRelevanceScore(a);
    if (relevanceDiff !== 0) return relevanceDiff;

    const confidenceDiff = a.confidenceScore - b.confidenceScore;
    if (confidenceDiff !== 0) return confidenceDiff;

    const aPublished = a.video.publishedAt?.getTime() ?? 0;
    const bPublished = b.video.publishedAt?.getTime() ?? 0;
    if (bPublished !== aPublished) return bPublished - aPublished;

    const aViews = a.video.viewCount !== null ? Number(a.video.viewCount) : 0;
    const bViews = b.video.viewCount !== null ? Number(b.video.viewCount) : 0;
    return bViews - aViews;
  });
}
