import { prisma } from "@/lib/db";

export async function listAnalysisJobs() {
  return prisma.analysisJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { channel: true, video: true },
  });
}

/** Cheap live counts for the top-header queue-status indicator. */
export async function getQueueStatusSummary() {
  const [queued, processing] = await Promise.all([
    prisma.analysisJob.count({ where: { status: "QUEUED" } }),
    prisma.analysisJob.count({ where: { status: "PROCESSING" } }),
  ]);
  return { queued, processing };
}
