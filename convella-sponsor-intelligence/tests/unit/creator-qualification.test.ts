import { describe, expect, it } from "vitest";
import {
  addUniqueSponsor,
  countsAsExternalPaidSponsor,
  evaluateQualification,
  looksCreatorOwned,
  normaliseSponsorKey,
  type SponsorCandidateDetection,
} from "@/lib/discovery/sponsor-qualification";
import { isEligibleLongForm, selectEligibleVideos } from "@/lib/discovery/video-eligibility";
import { decideContinuation } from "@/lib/discovery/service";
import { buildQualifiedCreatorsCsv, qualifiedCreatorsFilename, toConciseNiche } from "@/lib/csv/qualified-creators-export";

function detection(overrides: Partial<SponsorCandidateDetection> = {}): SponsorCandidateDetection {
  return {
    brandName: "Nimbus Notes",
    placementType: "SPONSORED_INTEGRATION",
    reviewStatus: "PENDING",
    confidenceScore: 0.95,
    evidenceText: "This video is sponsored by Nimbus Notes.",
    reasoningSummary: "Explicit paid disclosure naming the sponsor.",
    sponsorshipConfirmed: true,
    ...overrides,
  };
}

/**
 * Simulates the per-creator loop: analyse videos in order, applying the stopping
 * rules after each. Mirrors the sequential logic in qualification-pipeline.ts.
 */
function runCreator(videoSponsors: Array<string[]>): {
  outcome: "QUALIFIED" | "REJECTED";
  videosAnalysed: number;
  sponsors: string[];
  reason: string;
} {
  let sponsors: string[] = [];
  let videosAnalysed = 0;

  while (true) {
    const verdict = evaluateQualification({ uniqueSponsors: sponsors, videosAnalysed });
    if (verdict.action === "QUALIFY") return { outcome: "QUALIFIED", videosAnalysed, sponsors, reason: verdict.reason };
    if (verdict.action === "REJECT") return { outcome: "REJECTED", videosAnalysed, sponsors, reason: verdict.reason };

    if (videosAnalysed >= videoSponsors.length) {
      return sponsors.length > 0
        ? { outcome: "QUALIFIED", videosAnalysed, sponsors, reason: "Ran out of eligible videos with sponsors found." }
        : { outcome: "REJECTED", videosAnalysed, sponsors, reason: "Ran out of eligible videos." };
    }

    for (const brand of videoSponsors[videosAnalysed]) {
      sponsors = addUniqueSponsor(sponsors, brand).sponsors;
    }
    videosAnalysed += 1;
  }
}

// --- Required test 2 --------------------------------------------------------
describe("2. New creator with no sponsors in videos 1–4", () => {
  it("stops after the fourth video and rejects", () => {
    const result = runCreator([[], [], [], [], []]);
    expect(result.outcome).toBe("REJECTED");
    expect(result.videosAnalysed).toBe(4);
    expect(result.reason).toContain("newest 4 videos");
  });
});

// --- Required test 3 --------------------------------------------------------
describe("3. New creator with one sponsor in video 1", () => {
  it("keeps going to video five looking for a second sponsor", () => {
    const result = runCreator([["Nimbus Notes"], [], [], [], []]);
    expect(result.outcome).toBe("QUALIFIED");
    expect(result.videosAnalysed).toBe(5);
    expect(result.sponsors).toEqual(["Nimbus Notes"]);
  });

  it("stops early if a second sponsor turns up before video five", () => {
    const result = runCreator([["Nimbus Notes"], [], ["Aurora VPN"], [], []]);
    expect(result.outcome).toBe("QUALIFIED");
    expect(result.videosAnalysed).toBe(3);
    expect(result.sponsors).toEqual(["Nimbus Notes", "Aurora VPN"]);
  });
});

// --- Required test 4 --------------------------------------------------------
describe("4. New creator with two different sponsors in videos 1 and 2", () => {
  it("stops after video two and qualifies", () => {
    const result = runCreator([["Nimbus Notes"], ["Aurora VPN"], [], [], []]);
    expect(result.outcome).toBe("QUALIFIED");
    expect(result.videosAnalysed).toBe(2);
    expect(result.sponsors).toEqual(["Nimbus Notes", "Aurora VPN"]);
  });
});

// --- Required test 5 --------------------------------------------------------
describe("5. The same sponsor appears in multiple videos", () => {
  it("stores the brand once and keeps looking for a second unique sponsor", () => {
    const result = runCreator([["Nimbus Notes"], ["Nimbus Notes"], ["nimbus notes!"], [], []]);
    expect(result.sponsors).toEqual(["Nimbus Notes"]);
    expect(result.videosAnalysed).toBe(5); // never stopped early — only one unique sponsor
    expect(result.outcome).toBe("QUALIFIED");
  });

  it("treats case and punctuation variants as the same brand", () => {
    expect(normaliseSponsorKey("Nimbus Notes")).toBe(normaliseSponsorKey("nimbus-notes"));
    const { added } = addUniqueSponsor(["Nimbus Notes"], "NIMBUS NOTES");
    expect(added).toBe(false);
  });

  it("qualifies once a genuinely different second brand appears", () => {
    const result = runCreator([["Nimbus"], ["Nimbus"], ["Aurora"], [], []]);
    expect(result.videosAnalysed).toBe(3);
    expect(result.sponsors).toEqual(["Nimbus", "Aurora"]);
  });
});

// --- Required test 6 --------------------------------------------------------
describe("6. A creator promotes their own product", () => {
  it("does not count the creator's own course/SaaS/community as a sponsor", () => {
    const ownCourse = detection({
      brandName: "DevMastery Pro",
      evidenceText: "Join my course DevMastery Pro to learn everything I know.",
      reasoningSummary: "Creator promoting their own training product.",
    });
    expect(countsAsExternalPaidSponsor(ownCourse).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(ownCourse).reason).toContain("own product");

    expect(looksCreatorOwned("I built this tool myself")).toBe(true);
    expect(looksCreatorOwned("I'm the founder of Acme")).toBe(true);
    expect(looksCreatorOwned("Thanks to Acme for sponsoring")).toBe(false);
  });

  it("excludes affiliate-only, organic, gifted and unclear mentions", () => {
    expect(countsAsExternalPaidSponsor(detection({ placementType: "AFFILIATE_PROMOTION" })).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(detection({ placementType: "ORGANIC_MENTION" })).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(detection({ placementType: "FREE_PRODUCT_OR_GIFTED" })).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(detection({ placementType: "UNKNOWN" })).counts).toBe(false);
  });

  it("excludes detections a human has rejected or marked organic", () => {
    expect(countsAsExternalPaidSponsor(detection({ reviewStatus: "REJECTED" })).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(detection({ reviewStatus: "ORGANIC" })).counts).toBe(false);
  });

  it("excludes low-confidence unconfirmed detections", () => {
    expect(countsAsExternalPaidSponsor(detection({ sponsorshipConfirmed: false, confidenceScore: 0.5 })).counts).toBe(false);
    expect(countsAsExternalPaidSponsor(detection({ sponsorshipConfirmed: false, confidenceScore: 0.8 })).counts).toBe(true);
  });

  it("counts a genuine external paid sponsorship", () => {
    expect(countsAsExternalPaidSponsor(detection()).counts).toBe(true);
  });
});

// --- Required tests 7 and 8 -------------------------------------------------
describe("7 & 8. Run-level stopping conditions", () => {
  const base = { qualifiedTarget: 30, maxCandidatesPerRun: 150, searchExhausted: false };

  it("7. stops immediately once 30 qualified creators are found", () => {
    const decision = decideContinuation({ ...base, qualifiedCount: 30, candidatesAnalysed: 62 });
    expect(decision.action).toBe("STOP");
    expect(decision.stopReason).toContain("target of 30");
  });

  it("8. stops at 150 candidates and explains the partial result", () => {
    const decision = decideContinuation({ ...base, qualifiedCount: 12, candidatesAnalysed: 150 });
    expect(decision.action).toBe("STOP");
    expect(decision.stopReason).toContain("150");
    expect(decision.stopReason).toContain("12 qualified");
    expect(decision.stopReason).toContain("partial");
  });

  it("keeps going while under both limits", () => {
    expect(decideContinuation({ ...base, qualifiedCount: 5, candidatesAnalysed: 40 }).action).toBe("CONTINUE");
  });

  it("stops when searches stop returning anyone new", () => {
    const decision = decideContinuation({ ...base, qualifiedCount: 3, candidatesAnalysed: 20, searchExhausted: true });
    expect(decision.action).toBe("STOP");
    expect(decision.stopReason).toContain("no further new creators");
  });
});

// --- Video eligibility ------------------------------------------------------
describe("Video eligibility", () => {
  const video = (id: string, duration: number | null, isLivestream = false, day = 1) => ({
    youtubeVideoId: id,
    durationSeconds: duration,
    isLivestream,
    publishedAt: new Date(2026, 6, day),
  });

  it("rejects Shorts and anything under three minutes", () => {
    expect(isEligibleLongForm(video("a", 45)).reason).toBe("TOO_SHORT");
    expect(isEligibleLongForm(video("b", 179)).reason).toBe("TOO_SHORT");
    expect(isEligibleLongForm(video("c", 180)).eligible).toBe(true);
  });

  it("rejects livestream replays regardless of length", () => {
    expect(isEligibleLongForm(video("a", 7200, true)).reason).toBe("LIVESTREAM");
  });

  it("rejects unknown durations rather than assuming they are long-form", () => {
    expect(isEligibleLongForm(video("a", null)).reason).toBe("UNKNOWN_DURATION");
  });

  it("removes duplicates and returns eligible videos newest first", () => {
    const result = selectEligibleVideos([
      video("old", 600, false, 1),
      video("new", 600, false, 10),
      video("new", 600, false, 10), // duplicate
      video("short", 30, false, 9),
      video("stream", 5400, true, 8),
    ]);
    expect(result.eligible.map((v) => v.youtubeVideoId)).toEqual(["new", "old"]);
    expect(result.rejected.map((r) => r.reason).sort()).toEqual(["DUPLICATE", "LIVESTREAM", "TOO_SHORT"]);
  });
});

// --- CSV --------------------------------------------------------------------
describe("Qualified creators CSV", () => {
  it("emits exactly five columns in the required order", () => {
    const csv = buildQualifiedCreatorsCsv([
      {
        channelName: "Fictional Dev Creator",
        youtubeChannelId: "UCfictional123",
        niche: "AI developers",
        sponsorBrands: ["Nimbus Notes", "Aurora VPN"],
        latestEligibleVideoAt: new Date("2026-07-28T12:00:00Z"),
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("YouTuber Name,Channel URL,Niche,Sponsor Brands,Latest Video Date");
    expect(row).toBe(
      'Fictional Dev Creator,https://www.youtube.com/channel/UCfictional123,AI,Nimbus Notes | Aurora VPN,2026-07-28',
    );
  });

  it("gives one row per creator, never one per sponsor", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", niche: "Coding", sponsorBrands: ["X", "Y"], latestEligibleVideoAt: new Date("2026-07-01") },
      { channelName: "B", youtubeChannelId: "UC2", niche: "DevOps", sponsorBrands: ["Z"], latestEligibleVideoAt: new Date("2026-07-02") },
    ]);
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2 creators
  });

  it("caps sponsors at two per creator", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", niche: null, sponsorBrands: ["X", "Y", "Z"], latestEligibleVideoAt: null },
    ]);
    expect(csv).toContain("X | Y");
    expect(csv).not.toContain("Z");
  });

  it("keeps the niche column concise", () => {
    expect(toConciseNiche("SaaS founders")).toBe("SaaS");
    expect(toConciseNiche("DevOps / platform engineers")).toBe("DevOps");
    expect(toConciseNiche(null)).toBe("");
  });

  it("uses the required filename format", () => {
    expect(qualifiedCreatorsFilename(new Date("2026-08-03T09:00:00Z"))).toBe("qualified_creators_2026-08-03.csv");
  });

  it("leaves the date blank rather than guessing when unknown", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", niche: "AI", sponsorBrands: ["X"], latestEligibleVideoAt: null },
    ]);
    expect(csv.split("\r\n")[1].endsWith(",")).toBe(true);
  });
});
