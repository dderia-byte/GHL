import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("checkStage3CostLimits", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("blocks the next call once the max call count would be exceeded", async () => {
    vi.resetModules();
    process.env.MAX_NATIVE_VIDEO_CALLS_PER_VIDEO = "2";
    const { checkStage3CostLimits } = await import("@/lib/sponsor-analysis/cost");
    const check = checkStage3CostLimits({ callsMade: 2, secondsAnalysed: 0, estimatedCostSoFar: 0 }, 60);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("maximum of 2 native video calls");
  });

  it("blocks the next call once the max seconds would be exceeded", async () => {
    vi.resetModules();
    process.env.MAX_NATIVE_VIDEO_SECONDS_PER_VIDEO = "100";
    const { checkStage3CostLimits } = await import("@/lib/sponsor-analysis/cost");
    const check = checkStage3CostLimits({ callsMade: 0, secondsAnalysed: 60, estimatedCostSoFar: 0 }, 90);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("100 native video seconds");
  });

  it("blocks the next call once the dollar cost limit would be exceeded", async () => {
    vi.resetModules();
    process.env.MAX_ESTIMATED_COST_PER_VIDEO_USD = "0.001";
    const { checkStage3CostLimits } = await import("@/lib/sponsor-analysis/cost");
    const check = checkStage3CostLimits({ callsMade: 0, secondsAnalysed: 0, estimatedCostSoFar: 0 }, 90);
    expect(check.allowed).toBe(false);
  });

  it("allows the call when well within all limits", async () => {
    vi.resetModules();
    const { checkStage3CostLimits } = await import("@/lib/sponsor-analysis/cost");
    const check = checkStage3CostLimits({ callsMade: 0, secondsAnalysed: 0, estimatedCostSoFar: 0 }, 60);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBeNull();
  });
});
