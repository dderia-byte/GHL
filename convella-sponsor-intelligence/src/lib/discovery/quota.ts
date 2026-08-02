import { prisma } from "@/lib/db";

/** YouTube Data API v3 quota costs (units) — per Google's published pricing. */
export const QUOTA_COST = {
  SEARCH_PAGE: 100,
  CHANNELS_LIST: 1,
  PLAYLIST_ITEMS_PAGE: 1,
  VIDEOS_LIST: 1,
} as const;

/** UTC day bucket, e.g. "2026-08-02" — quota resets on YouTube's daily boundary. */
export function quotaDayBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Pure reservation decision, unit-tested directly: can `unitsRequested` more units be
 * reserved when `unitsAlreadyReserved` are already reserved-or-committed today against
 * `dailyBudget`? Landing exactly on the budget is allowed; exceeding it is not.
 */
export function canReserveQuota(unitsAlreadyReserved: number, unitsRequested: number, dailyBudget: number): boolean {
  return unitsAlreadyReserved + unitsRequested <= dailyBudget;
}

export class QuotaExhaustedError extends Error {
  constructor(
    public readonly requested: number,
    public readonly used: number,
    public readonly budget: number,
  ) {
    super(
      `YouTube quota budget exhausted: ${used}/${budget} units used today, ${requested} more requested. ` +
        `The run can resume after the daily quota window resets or the budget is raised.`,
    );
    this.name = "QuotaExhaustedError";
  }
}

/**
 * Reserve-then-commit ledger over the QuotaLedger table.
 *
 * Usage: `reserve()` BEFORE the API call (throws QuotaExhaustedError if the day's
 * budget cannot cover it — the caller halts the run, this is not a job failure);
 * then `commit()` after a successful call or `release()` after a failed one.
 * `reservationKey` makes replays idempotent: a retried job re-reserving the same key
 * is a no-op returning the existing row.
 */
export async function reserveQuota(options: {
  reservationKey: string;
  units: number;
  purpose: "search" | "hydration";
  dailyBudget: number;
  jobId?: string;
  now?: Date;
}): Promise<{ alreadyReserved: boolean }> {
  const date = quotaDayBucket(options.now);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quotaLedger.findUnique({ where: { reservationKey: options.reservationKey } });
    if (existing) return { alreadyReserved: true };

    const aggregate = await tx.quotaLedger.aggregate({
      where: { date, released: false },
      _sum: { unitsReserved: true },
    });
    const used = aggregate._sum.unitsReserved ?? 0;

    if (!canReserveQuota(used, options.units, options.dailyBudget)) {
      throw new QuotaExhaustedError(options.units, used, options.dailyBudget);
    }

    await tx.quotaLedger.create({
      data: {
        date,
        purpose: options.purpose,
        jobId: options.jobId,
        reservationKey: options.reservationKey,
        unitsReserved: options.units,
      },
    });
    return { alreadyReserved: false };
  });
}

/**
 * Commit = mark the reserved units as actually spent. Reserved-but-uncommitted rows
 * still count against the day's budget until released, so a crash between reserve
 * and commit can never under-count.
 */
export async function commitQuota(reservationKey: string): Promise<void> {
  const row = await prisma.quotaLedger.findUnique({ where: { reservationKey } });
  if (row && !row.released) {
    await prisma.quotaLedger.update({
      where: { reservationKey },
      data: { unitsCommitted: row.unitsReserved },
    });
  }
}

/** Releases a reservation whose API call failed — its units return to the day's budget. */
export async function releaseQuota(reservationKey: string): Promise<void> {
  await prisma.quotaLedger.updateMany({
    where: { reservationKey },
    data: { released: true },
  });
}

/** Units reserved-or-committed (and not released) for a UTC day — the dashboard read. */
export async function getQuotaUsedToday(now: Date = new Date()): Promise<number> {
  const aggregate = await prisma.quotaLedger.aggregate({
    where: { date: quotaDayBucket(now), released: false },
    _sum: { unitsReserved: true },
  });
  return aggregate._sum.unitsReserved ?? 0;
}
