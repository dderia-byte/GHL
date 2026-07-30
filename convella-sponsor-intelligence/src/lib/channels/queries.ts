import { prisma } from "@/lib/db";

export async function getChannelDetails(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      videos: {
        orderBy: { publishedAt: "desc" },
        include: { sponsorshipDetections: { include: { brand: true } } },
      },
    },
  });
  if (!channel) return null;

  const videosAnalysed = channel.videos.filter((v) =>
    ["SPONSOR_FOUND", "NO_SPONSOR_FOUND", "PARTIAL", "FAILED"].includes(v.analysisStatus),
  ).length;
  const allDetections = channel.videos.flatMap((v) => v.sponsorshipDetections);
  const sponsorsDetected = allDetections.length;
  const confirmedSponsorships = allDetections.filter((d) => d.reviewStatus === "CONFIRMED").length;

  const views = channel.videos.map((v) => (v.viewCount !== null ? Number(v.viewCount) : null)).filter((v): v is number => v !== null);
  const averageRecentViews = views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : null;

  return { channel, videosAnalysed, sponsorsDetected, confirmedSponsorships, averageRecentViews };
}

export type ChannelDetails = NonNullable<Awaited<ReturnType<typeof getChannelDetails>>>;
