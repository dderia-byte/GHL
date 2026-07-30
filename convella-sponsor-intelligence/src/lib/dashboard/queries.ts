import { prisma } from "@/lib/db";

export async function getDashboardData() {
  const [
    channelsMonitored,
    videosAnalysed,
    sponsorshipsDetected,
    confirmedSponsorships,
    brandsDiscovered,
    awaitingReview,
    videosProcessing,
    failedAnalyses,
    completedVideoJobs,
    recentDetections,
    detectionsByBrand,
  ] = await Promise.all([
    prisma.channel.count(),
    prisma.video.count({ where: { analysisStatus: { in: ["SPONSOR_FOUND", "NO_SPONSOR_FOUND", "PARTIAL", "FAILED"] } } }),
    prisma.sponsorshipDetection.count(),
    prisma.sponsorshipDetection.count({ where: { reviewStatus: "CONFIRMED" } }),
    prisma.brand.count(),
    prisma.sponsorshipDetection.count({ where: { reviewStatus: "PENDING" } }),
    prisma.video.count({ where: { analysisStatus: { in: ["QUEUED", "PROCESSING"] } } }),
    prisma.video.count({ where: { analysisStatus: "FAILED" } }),
    prisma.analysisJob.findMany({
      where: { jobType: "VIDEO_ANALYSIS", status: "COMPLETED" },
      select: { estimatedCost: true },
    }),
    prisma.sponsorshipDetection.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { brand: true, video: { include: { channel: true } } },
    }),
    prisma.sponsorshipDetection.groupBy({
      by: ["brandId"],
      _count: { brandId: true },
      where: { brandId: { not: null } },
      orderBy: { _count: { brandId: "desc" } },
      take: 5,
    }),
  ]);

  const sponsorFoundVideos = await prisma.video.findMany({
    where: { analysisStatus: "SPONSOR_FOUND" },
    select: { secondsAnalysed: true },
  });
  const averageSecondsWatched = sponsorFoundVideos.length
    ? Math.round(sponsorFoundVideos.reduce((sum, v) => sum + v.secondsAnalysed, 0) / sponsorFoundVideos.length)
    : null;

  const averageModelCost = completedVideoJobs.length
    ? completedVideoJobs.reduce((sum, j) => sum + j.estimatedCost, 0) / completedVideoJobs.length
    : null;

  const brandIds = detectionsByBrand.map((d) => d.brandId).filter((id): id is string => Boolean(id));
  const brands = brandIds.length ? await prisma.brand.findMany({ where: { id: { in: brandIds } } }) : [];
  const topBrands = detectionsByBrand
    .map((d) => ({
      brand: brands.find((b) => b.id === d.brandId),
      count: d._count.brandId,
    }))
    .filter((b) => b.brand);

  const categoryConfirmedCounts = new Map<string, number>();
  const confirmedByCategory = await prisma.sponsorshipDetection.findMany({
    where: { reviewStatus: "CONFIRMED" },
    include: { brand: { select: { category: true } } },
  });
  for (const detection of confirmedByCategory) {
    const category = detection.brand?.category ?? "Uncategorised";
    categoryConfirmedCounts.set(category, (categoryConfirmedCounts.get(category) ?? 0) + 1);
  }
  const topCategories = Array.from(categoryConfirmedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    channelsMonitored,
    videosAnalysed,
    sponsorshipsDetected,
    confirmedSponsorships,
    brandsDiscovered,
    awaitingReview,
    videosProcessing,
    failedAnalyses,
    averageSecondsWatched,
    averageModelCost,
    recentDetections,
    topBrands,
    topCategories,
  };
}
