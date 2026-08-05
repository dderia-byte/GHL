import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getDaySpendUsd, decimalToNumber } from "./budgets";
import { getQuotaUsedToday } from "./quota";
import { TERMINAL_CANDIDATE_STATES } from "./service";

export async function getDiscoveryDashboardData() {
  const [dailyCostLimit, perRunCostLimit, dailyQuotaUnits] = await Promise.all([
    getSetting("budgets.dailyCostLimitUsd"),
    getSetting("budgets.perRunCostLimitUsd"),
    getSetting("budgets.dailyQuotaUnits"),
  ]);

  const dayStart = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [daySpend, quotaUsedToday, activeRun, recentRuns, enabledQueries, qualifiedToday] = await Promise.all([
    getDaySpendUsd(),
    getQuotaUsedToday(),
    prisma.discoveryRun.findFirst({
      where: { status: { in: ["QUEUED", "RUNNING", "PAUSED", "HALTED_COST_LIMIT", "HALTED_QUOTA_LIMIT"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.discoveryRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.discoveryQuery.count({ where: { enabled: true } }),
    prisma.discoveryCandidate.count({
      where: { state: { in: ["QUALIFIED", "DEEP_SCANNING", "QUALIFIED_PARTIAL", "COMPLETED"] }, updatedAt: { gte: dayStart } },
    }),
  ]);

  const activeRunStates = activeRun
    ? await prisma.discoveryCandidate.groupBy({
        by: ["state"],
        where: { discoveryRunId: activeRun.id },
        _count: { state: true },
      })
    : [];

  const activeCandidate = activeRun
    ? await prisma.discoveryCandidate.findFirst({
        where: { discoveryRunId: activeRun.id, state: { notIn: TERMINAL_CANDIDATE_STATES } },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  const qualifiedTotal = await prisma.channel.count({ where: { qualifiedAt: { not: null } } });

  return {
    qualifiedTotal,
    budgets: {
      daySpend,
      dailyCostLimit,
      perRunCostLimit,
      quotaUsedToday,
      dailyQuotaUnits,
      qualifiedToday,
    },
    activeRun,
    activeRunStates: activeRunStates.map((s) => ({ state: s.state, count: s._count.state })),
    activeCandidate,
    recentRuns,
    enabledQueries,
  };
}

export async function listDiscoveryRuns() {
  return prisma.discoveryRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}

export async function getDiscoveryRunDetail(runId: string) {
  const run = await prisma.discoveryRun.findUnique({
    where: { id: runId },
    include: {
      candidates: {
        orderBy: { createdAt: "asc" },
        include: { query: { select: { queryText: true } }, channel: { select: { id: true, name: true } } },
      },
    },
  });
  if (!run) return null;

  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "DiscoveryRun", entityId: runId },
        { entityType: "DiscoveryCandidate", entityId: { in: run.candidates.map((c) => c.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { run, audit };
}

export async function listDiscoveryQueries() {
  return prisma.discoveryQuery.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
}

export type CreatorTab = "qualified" | "borderline" | "rejected" | "all";

export async function listDiscoveredCreators(tab: CreatorTab) {
  const where: Prisma.DiscoveryCandidateWhereInput =
    tab === "qualified"
      ? { state: { in: ["QUALIFIED", "DEEP_SCANNING", "QUALIFIED_PARTIAL", "COMPLETED"] } }
      : tab === "borderline"
        ? { borderline: true }
        : tab === "rejected"
          ? { state: { in: ["FILTERED_OUT", "REJECTED_NOT_COMMERCIAL", "REJECTED_NO_SPONSOR"] } }
          : {};

  const candidates = await prisma.discoveryCandidate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      query: { select: { queryText: true } },
      channel: { select: { id: true, name: true, subscriberCount: true, thumbnailUrl: true } },
      run: { select: { id: true, createdAt: true } },
    },
  });

  // Sponsors found per candidate's channel (only for candidates with a channel row).
  const channelIds = candidates.map((c) => c.channel?.id).filter((id): id is string => Boolean(id));
  const detections = channelIds.length
    ? await prisma.sponsorshipDetection.findMany({
        where: { video: { channelId: { in: channelIds } } },
        include: { brand: { select: { displayName: true } }, video: { select: { channelId: true } } },
      })
    : [];

  const brandsByChannel = new Map<string, Set<string>>();
  for (const d of detections) {
    const channelId = d.video.channelId;
    if (!brandsByChannel.has(channelId)) brandsByChannel.set(channelId, new Set());
    brandsByChannel.get(channelId)!.add(d.brand?.displayName ?? d.rawBrandName);
  }

  return candidates.map((c) => ({
    ...c,
    estimatedCostNumber: decimalToNumber(c.estimatedCost),
    sponsorBrands: c.channel ? Array.from(brandsByChannel.get(c.channel.id) ?? []) : [],
  }));
}
