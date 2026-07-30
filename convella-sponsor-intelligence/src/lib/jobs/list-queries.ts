import { prisma } from "@/lib/db";

export async function listAnalysisJobs() {
  return prisma.analysisJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { channel: true, video: true },
  });
}
