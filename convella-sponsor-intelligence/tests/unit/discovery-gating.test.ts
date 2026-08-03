import { describe, expect, it } from "vitest";
import { runFreeGate, type GatingVideoInput } from "@/lib/discovery/gating";

function video(index: number, overrides: Partial<GatingVideoInput> = {}): GatingVideoInput {
  return {
    index,
    title: `Fictional video ${index}`,
    description: "A plain video with no commercial content.",
    tags: [],
    paidProductPlacement: false,
    ...overrides,
  };
}

const SPONSORED = "This video is sponsored by Nimbus Notes. Try it at https://nimbusnotes.example.com/";

describe("runFreeGate", () => {
  it("qualifies a creator whose OLDER video is sponsored (the yield fix)", () => {
    // Newest two uploads are unsponsored — the old gate rejected this creator
    // outright. The free gate still finds the sponsor at index 3, for zero cost.
    const decision = runFreeGate([video(0), video(1), video(2), video(3, { description: SPONSORED }), video(4)]);
    expect(decision.freeQualifyingIndex).toBe(3);
    expect(decision.freeQualifyingBrand).toBe("Nimbus Notes");
  });

  it("prefers the most recent disclosure when several videos are sponsored", () => {
    const decision = runFreeGate([
      video(0),
      video(1, { description: SPONSORED }),
      video(2, { description: "This video is sponsored by Aurora VPN. https://auroravpn.example.com/" }),
    ]);
    expect(decision.freeQualifyingIndex).toBe(1);
    expect(decision.freeQualifyingBrand).toBe("Nimbus Notes");
  });

  it("spends nothing on a creator with no commercial signals anywhere", () => {
    const decision = runFreeGate([video(0), video(1), video(2)]);
    expect(decision.freeQualifyingIndex).toBeNull();
    expect(decision.paidOrder).toEqual([]);
  });

  it("ranks signal-bearing videos best-first for the paid phase", () => {
    const decision = runFreeGate([
      video(0, { description: "Links below. Check out my setup: https://example.com/gear" }), // cta-with-links only
      video(1, { description: "Use code SAVE20 for 20% off at https://example.com" }), // discount code
      video(2, { paidProductPlacement: true }), // strongest predictor
    ]);
    expect(decision.freeQualifyingIndex).toBeNull();
    expect(decision.paidOrder[0]).toBe(2);
    expect(decision.paidOrder).toContain(1);
  });

  it("excludes already-qualifying videos from the paid order", () => {
    const decision = runFreeGate([
      video(0, { description: "Use code SAVE20 at https://example.com" }),
      video(1, { description: SPONSORED }),
    ]);
    expect(decision.freeQualifyingIndex).toBe(1);
    expect(decision.paidOrder).not.toContain(1);
  });

  it("records a per-video audit trail for every scanned video", () => {
    const decision = runFreeGate([video(0, { description: SPONSORED }), video(1), video(2, { paidProductPlacement: true })]);
    expect(decision.perVideo).toHaveLength(3);
    expect(decision.perVideo[0].strongDisclosure).toBe(true);
    expect(decision.perVideo[1].signalClasses).toEqual([]);
    expect(decision.perVideo[2].signalClasses).toContain("paid-product-placement-flag");
  });

  it("handles an empty video list without throwing", () => {
    const decision = runFreeGate([]);
    expect(decision).toMatchObject({ freeQualifyingIndex: null, paidOrder: [], perVideo: [] });
  });
});
