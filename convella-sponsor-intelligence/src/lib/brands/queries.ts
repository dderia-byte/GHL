import { prisma } from "@/lib/db";

export async function listBrandsWithStats() {
  const brands = await prisma.brand.findMany({
    include: { sponsorshipDetections: { include: { video: { include: { channel: true } } } } },
    orderBy: { canonicalName: "asc" },
  });

  return brands.map((brand) => {
    const detections = brand.sponsorshipDetections;
    const confirmed = detections.filter((d) => d.reviewStatus === "CONFIRMED");
    const creatorIds = new Set(detections.map((d) => d.video.channel.id));
    const avgConfidence = detections.length
      ? detections.reduce((sum, d) => sum + d.confidenceScore, 0) / detections.length
      : null;
    const avgViews = detections.length
      ? Math.round(
          detections.reduce((sum, d) => sum + (d.video.viewCount !== null ? Number(d.video.viewCount) : 0), 0) /
            detections.length,
        )
      : null;
    const placementTypes = Array.from(new Set(detections.map((d) => d.placementType)));
    const mostRecent = detections
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const reviewedCount = detections.filter((d) => d.reviewStatus !== "PENDING").length;

    return {
      brand,
      placementsDetected: detections.length,
      placementsConfirmed: confirmed.length,
      associatedCreators: creatorIds.size,
      mostRecentDetectionAt: mostRecent?.createdAt ?? null,
      averageConfidence: avgConfidence,
      averageCreatorViews: avgViews,
      placementTypes,
      reviewStatus: detections.length === 0 ? "No detections" : reviewedCount === detections.length ? "Fully reviewed" : "Needs review",
    };
  });
}

export async function getBrandDetails(brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      sponsorshipDetections: {
        include: { video: { include: { channel: true } }, evidence: true },
        orderBy: { createdAt: "desc" },
      },
      competitorSuggestions: { orderBy: { confidenceScore: "desc" } },
      creatorOpportunities: { include: { channel: true }, orderBy: { opportunityScore: "desc" } },
    },
  });
  return brand;
}

export type BrandDetails = NonNullable<Awaited<ReturnType<typeof getBrandDetails>>>;
