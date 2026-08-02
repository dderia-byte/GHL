import { describe, expect, it } from "vitest";
import { canReserveQuota, quotaDayBucket, QUOTA_COST, QuotaExhaustedError } from "@/lib/discovery/quota";
import { canSpend } from "@/lib/discovery/budgets";

describe("quota reservation arithmetic", () => {
  it("allows a reservation within budget", () => {
    expect(canReserveQuota(0, 100, 8000)).toBe(true);
    expect(canReserveQuota(7000, 500, 8000)).toBe(true);
  });

  it("allows landing exactly on the budget", () => {
    expect(canReserveQuota(7900, 100, 8000)).toBe(true);
  });

  it("rejects exceeding the budget by any amount", () => {
    expect(canReserveQuota(7901, 100, 8000)).toBe(false);
    expect(canReserveQuota(8000, 1, 8000)).toBe(false);
  });

  it("a zero budget rejects everything except zero-unit requests", () => {
    expect(canReserveQuota(0, 1, 0)).toBe(false);
    expect(canReserveQuota(0, 0, 0)).toBe(true);
  });

  it("search costs 100 units per page per Google's published pricing", () => {
    expect(QUOTA_COST.SEARCH_PAGE).toBe(100);
    expect(QUOTA_COST.CHANNELS_LIST).toBe(1);
  });

  it("QuotaExhaustedError carries a resumable, user-facing message", () => {
    const error = new QuotaExhaustedError(100, 7950, 8000);
    expect(error.message).toContain("7950/8000");
    expect(error.message).toContain("resume");
  });
});

describe("quotaDayBucket", () => {
  it("buckets by UTC day", () => {
    expect(quotaDayBucket(new Date("2026-08-02T23:59:59.999Z"))).toBe("2026-08-02");
    expect(quotaDayBucket(new Date("2026-08-03T00:00:00.000Z"))).toBe("2026-08-03");
  });
});

describe("canSpend (cost pre-flight)", () => {
  const base = { perRunLimitUsd: 10, dailyLimitUsd: 25, estimatedNextCost: 0.15 };

  it("allows spend within both budgets", () => {
    expect(canSpend({ ...base, runSpendSoFar: 5, daySpendSoFar: 10 })).toEqual({ allowed: true, blockedBy: null });
  });

  it("blocks on the run limit first", () => {
    expect(canSpend({ ...base, runSpendSoFar: 9.9, daySpendSoFar: 0 })).toEqual({ allowed: false, blockedBy: "run" });
  });

  it("blocks on the day limit when the run budget still has room", () => {
    expect(canSpend({ ...base, runSpendSoFar: 0, daySpendSoFar: 24.9 })).toEqual({ allowed: false, blockedBy: "day" });
  });

  it("allows landing exactly on a limit", () => {
    expect(canSpend({ ...base, estimatedNextCost: 0.1, runSpendSoFar: 9.9, daySpendSoFar: 0 }).allowed).toBe(true);
    expect(canSpend({ ...base, estimatedNextCost: 0.1, runSpendSoFar: 0, daySpendSoFar: 24.9 }).allowed).toBe(true);
  });

  it("a zero daily limit blocks all non-zero spend (kill switch)", () => {
    expect(canSpend({ ...base, dailyLimitUsd: 0, runSpendSoFar: 0, daySpendSoFar: 0 })).toEqual({
      allowed: false,
      blockedBy: "day",
    });
  });
});
