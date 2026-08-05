import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Pure budget decision, unit-tested directly. `estimatedNextCost` is the conservative
 * worst-case estimate for the NEXT pipeline call; the check must pass against BOTH
 * the run's remaining budget and the day's remaining budget. Landing exactly on a
 * limit is allowed.
 */
export function canSpend(options: {
  runSpendSoFar: number;
  perRunLimitUsd: number;
  daySpendSoFar: number;
  dailyLimitUsd: number;
  estimatedNextCost: number;
}): { allowed: boolean; blockedBy: "run" | "day" | null } {
  if (options.runSpendSoFar + options.estimatedNextCost > options.perRunLimitUsd) {
    return { allowed: false, blockedBy: "run" };
  }
  if (options.daySpendSoFar + options.estimatedNextCost > options.dailyLimitUsd) {
    return { allowed: false, blockedBy: "day" };
  }
  return { allowed: true, blockedBy: null };
}

/**
 * Conservative per-video worst-case estimate used for pre-flight checks: the
 * per-video cost cap the pipeline itself enforces (MAX_ESTIMATED_COST_PER_VIDEO_USD).
 * Reserving at the cap means a halt can only ever fire EARLY, never late — the
 * correct side to err on for a spend guardrail. At concurrency 1 the check-then-run
 * sequence is race-free by construction; if concurrency is ever raised, this check
 * must move into a reservation ledger like src/lib/discovery/quota.ts (see spec §13.4).
 */
export function getWorstCasePerVideoCost(maxEstimatedCostPerVideoUsd: number): number {
  return maxEstimatedCostPerVideoUsd;
}

/** Sum of estimated model spend across ALL analyses in a UTC day (discovery + manual). */
export async function getDaySpendUsd(now: Date = new Date()): Promise<number> {
  const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const aggregate = await prisma.analysisUsage.aggregate({
    where: { createdAt: { gte: dayStart } },
    _sum: { totalEstimatedCost: true },
  });
  return decimalToNumber(aggregate._sum.totalEstimatedCost);
}

export function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
