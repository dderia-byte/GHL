import { prisma } from "@/lib/db";

export async function getVideoDetails(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      channel: true,
      sponsorshipDetections: {
        include: { brand: true, evidence: { orderBy: { timestampSeconds: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
      analysisJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      analysisUsages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return video;
}

export type VideoDetails = NonNullable<Awaited<ReturnType<typeof getVideoDetails>>>;
