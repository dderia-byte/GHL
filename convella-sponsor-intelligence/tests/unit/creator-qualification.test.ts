import { describe, expect, it } from "vitest";
import {
  addUniqueSponsor,
  countsAsExternalPaidSponsor,
  evaluateQualification,
  looksCreatorOwned,
  mergeSponsorEvidence,
  mergeSponsorLists,
  normaliseSponsorKey,
  youtubeVideoUrl,
  type SponsorCandidateDetection,
} from "@/lib/discovery/sponsor-qualification";
import { classifyDiscovery, mergeDiscoveriesByChannel } from "@/lib/discovery/duplicate-policy";
import { isEligibleLongForm, selectEligibleVideos } from "@/lib/discovery/video-eligibility";
import { decideContinuation } from "@/lib/discovery/service";
import { buildQualifiedCreatorsCsv, qualifiedCreatorsFilename } from "@/lib/csv/qualified-creators-export";

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
describe("2. New creator with no sponsors in the newest four videos", () => {
  it("stops after the fourth video and rejects — never analyses a fifth", () => {
    const result = runCreator([[], [], [], [], []]);
    expect(result.outcome).toBe("REJECTED");
    expect(result.videosAnalysed).toBe(4);
    expect(result.reason).toContain("newest 4 eligible videos");
  });
});

// --- Required test 3 --------------------------------------------------------
describe("3. New creator with one sponsor in video 1", () => {
  it("still analyses all four, then qualifies", () => {
    const result = runCreator([["Nimbus Notes"], [], [], [], []]);
    expect(result.outcome).toBe("QUALIFIED");
    expect(result.videosAnalysed).toBe(4);
    expect(result.sponsors).toEqual(["Nimbus Notes"]);
  });
});

// --- Required test 4 --------------------------------------------------------
describe("4. Two of the newest four videos contain different sponsors", () => {
  it("collects both and qualifies after the fourth video", () => {
    const result = runCreator([["Nimbus Notes"], ["Aurora VPN"], [], []]);
    expect(result.outcome).toBe("QUALIFIED");
    expect(result.videosAnalysed).toBe(4);
    expect(result.sponsors).toEqual(["Nimbus Notes", "Aurora VPN"]);
  });

  it("collects three or more — there is no cap on unique sponsors", () => {
    const result = runCreator([["Convex"], ["Browserbase"], ["Nimbus Notes"], []]);
    expect(result.sponsors).toEqual(["Convex", "Browserbase", "Nimbus Notes"]);
  });
});

// --- Required test 5 --------------------------------------------------------
describe("5. The same sponsor appears in multiple videos", () => {
  it("stores the brand once", () => {
    const result = runCreator([["Nimbus Notes"], ["Nimbus Notes"], ["nimbus notes!"], []]);
    expect(result.sponsors).toEqual(["Nimbus Notes"]);
    expect(result.outcome).toBe("QUALIFIED");
  });

  it("treats case and punctuation variants as the same brand", () => {
    expect(normaliseSponsorKey("Nimbus Notes")).toBe(normaliseSponsorKey("nimbus-notes"));
    const { added } = addUniqueSponsor(["Nimbus Notes"], "NIMBUS NOTES");
    expect(added).toBe(false);
  });

  it("treats a domain form as the same brand as the display name", () => {
    expect(normaliseSponsorKey("PostHog")).toBe("posthog");
    expect(normaliseSponsorKey("posthog.com")).toBe("posthog");
    expect(normaliseSponsorKey("Post Hog")).toBe("posthog");
    expect(normaliseSponsorKey("https://www.posthog.com/pricing")).toBe("posthog");
    expect(addUniqueSponsor(["PostHog"], "posthog.com").added).toBe(false);
    expect(addUniqueSponsor(["PostHog"], "Post Hog").added).toBe(false);
  });

  it("does not collapse genuinely different brands that share a suffix", () => {
    expect(normaliseSponsorKey("Convex")).not.toBe(normaliseSponsorKey("Browserbase"));
    expect(addUniqueSponsor(["Convex"], "Convex Labs").added).toBe(true);
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

// --- Duplicate policy (current run only) ------------------------------------
describe("Duplicate policy", () => {
  const empty: ReadonlySet<string> = new Set();

  it("A. the same creator found under three different keywords is analysed once", () => {
    const hits = [
      { youtubeChannelId: "UCcreator", discoveryQueryId: "q-ai-tools" },
      { youtubeChannelId: "UCcreator", discoveryQueryId: "q-ai-coding" },
      { youtubeChannelId: "UCcreator", discoveryQueryId: "q-vibe-coding" },
      { youtubeChannelId: "UCother", discoveryQueryId: "q-ai-tools" },
    ];
    const merged = mergeDiscoveriesByChannel(hits);
    expect(merged).toHaveLength(2);
    // First keyword to find them owns the provenance.
    expect(merged[0].discoveryQueryId).toBe("q-ai-tools");
    // And the repeats are merged, never counted as a rejected duplicate.
    expect(classifyDiscovery({ youtubeChannelId: "UCcreator", candidateIdsThisRun: empty }).action).toBe("ANALYSE");
  });

  it("merges a creator already made a candidate earlier in THIS run", () => {
    const disposition = classifyDiscovery({
      youtubeChannelId: "UCcreator",
      candidateIdsThisRun: new Set(["UCcreator"]),
    });
    expect(disposition.action).toBe("MERGE");
  });

  it("does NOT skip a creator qualified and exported by a previous run", () => {
    // The permanent blocklist is gone: SQL is history, not an exclusion rule. A
    // creator exported last month is analysed again and may appear in a new CSV.
    expect(classifyDiscovery({ youtubeChannelId: "UCexportedLastMonth", candidateIdsThisRun: empty }).action).toBe(
      "ANALYSE",
    );
  });

  it("does NOT skip a creator rejected by a previous run", () => {
    expect(classifyDiscovery({ youtubeChannelId: "UCrejectedLastMonth", candidateIdsThisRun: empty }).action).toBe(
      "ANALYSE",
    );
  });

  it("has no SKIP disposition at all — only ANALYSE or MERGE", () => {
    const ids = ["UCa", "UCb", "UCc"];
    const actions = ids.map((id) => classifyDiscovery({ youtubeChannelId: id, candidateIdsThisRun: new Set(["UCb"]) }).action);
    expect(actions).toEqual(["ANALYSE", "MERGE", "ANALYSE"]);
  });
});

// --- Required test B: merging sponsor evidence ------------------------------
describe("B. The same creator is reached twice with different sponsor evidence", () => {
  it("merges the unique sponsors into one record", () => {
    expect(mergeSponsorLists(["Convex"], ["Browserbase"])).toEqual(["Convex", "Browserbase"]);
  });

  it("does not repeat a brand that both discoveries found", () => {
    expect(mergeSponsorLists(["Convex", "Browserbase"], ["convex.dev", "Nimbus Notes"])).toEqual([
      "Convex",
      "Browserbase",
      "Nimbus Notes",
    ]);
  });

  it("is order-independent for the set of brands", () => {
    const a = mergeSponsorLists(["A"], ["B"], ["C"]);
    const b = mergeSponsorLists(["C"], ["B"], ["A"]);
    expect([...a].sort()).toEqual([...b].sort());
  });
});

// --- CSV --------------------------------------------------------------------
describe("Qualified creators CSV", () => {
  it("emits exactly five columns in the required order, with no Duplicate column", () => {
    const csv = buildQualifiedCreatorsCsv([
      {
        channelName: "Fictional Dev Creator",
        youtubeChannelId: "UCfictional123",
        handle: "@fictionaldev",
        niche: "AI Development",
        sponsorBrands: ["Convex", "Browserbase"],
        latestEligibleVideoAt: new Date("2026-08-03T12:00:00Z"),
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("YouTuber Name,Channel URL,Niche,Sponsor Brands,Latest Video Date");
    expect(header).not.toContain("Duplicate");
    expect(row).toBe(
      "Fictional Dev Creator,https://www.youtube.com/@fictionaldev,AI Development,Convex | Browserbase,2026-08-03",
    );
  });

  it("C. puts every unique sponsor in one cell separated by ' | '", () => {
    const csv = buildQualifiedCreatorsCsv([
      {
        channelName: "A",
        youtubeChannelId: "UC1",
        sponsorBrands: ["Brand One", "Brand Two", "Brand Three"],
        latestEligibleVideoAt: null,
      },
    ]);
    expect(csv).toContain("Brand One | Brand Two | Brand Three");
  });

  it("never repeats the same brand, including its domain form", () => {
    const csv = buildQualifiedCreatorsCsv([
      {
        channelName: "A",
        youtubeChannelId: "UC1",
        sponsorBrands: ["PostHog", "posthog.com", "Post Hog", "Convex"],
        latestEligibleVideoAt: null,
      },
    ]);
    const cell = csv.split("\r\n")[1];
    expect(cell).toContain("PostHog | Convex");
    expect(cell).not.toContain("posthog.com");
  });

  it("gives one row per creator, never one per sponsor", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", sponsorBrands: ["X", "Y"], latestEligibleVideoAt: new Date("2026-07-01") },
      { channelName: "B", youtubeChannelId: "UC2", sponsorBrands: ["Z"], latestEligibleVideoAt: new Date("2026-07-02") },
    ]);
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2 creators
  });

  it("A (export half). the same creator passed in twice becomes one row with merged sponsors", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "Chris", youtubeChannelId: "UC1", sponsorBrands: ["Convex"], latestEligibleVideoAt: new Date("2026-07-01") },
      { channelName: "Chris", youtubeChannelId: "UC1", sponsorBrands: ["Browserbase"], latestEligibleVideoAt: new Date("2026-08-03") },
    ]);
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(2); // header + ONE creator
    expect(rows[1]).toContain("Convex | Browserbase");
    expect(rows[1]).toContain("2026-08-03"); // newest of the two dates
  });

  it("falls back to the channel-id URL when there is no handle", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UCfictional123", sponsorBrands: ["X"], latestEligibleVideoAt: null },
    ]);
    expect(csv).toContain("https://www.youtube.com/channel/UCfictional123");
  });

  it("uses the required filename format", () => {
    expect(qualifiedCreatorsFilename(new Date("2026-08-03T09:00:00Z"))).toBe("qualified_creators_2026-08-03.csv");
  });

  it("leaves the date and niche blank rather than guessing when unknown", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", sponsorBrands: ["X"], latestEligibleVideoAt: null },
    ]);
    expect(csv.split("\r\n")[1]).toBe("A,https://www.youtube.com/channel/UC1,,X,");
  });
});

// --- Sponsor evidence (stored in SQL, never in the CSV) ---------------------
describe("Sponsor video evidence", () => {
  const entry = (brand: string, videoId: string, publishedAt: string | null = "2026-08-03T00:00:00.000Z") => ({
    brand,
    youtubeVideoId: videoId,
    videoUrl: youtubeVideoUrl(videoId),
    publishedAt,
  });

  it("builds a watchable URL from the video id", () => {
    expect(youtubeVideoUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("keeps one entry per brand — the video that first proved it", () => {
    const merged = mergeSponsorEvidence(
      [entry("Convex", "vid1")],
      [entry("Convex", "vid3"), entry("Browserbase", "vid2")],
    );
    expect(merged.map((e) => e.brand)).toEqual(["Convex", "Browserbase"]);
    expect(merged[0].youtubeVideoId).toBe("vid1"); // first proof wins
  });

  it("collapses domain variants onto the same brand entry", () => {
    const merged = mergeSponsorEvidence([entry("PostHog", "vid1")], [entry("posthog.com", "vid2")]);
    expect(merged).toHaveLength(1);
  });

  it("records the publish date, or null when YouTube did not give one", () => {
    const merged = mergeSponsorEvidence([entry("Convex", "vid1", null)]);
    expect(merged[0].publishedAt).toBeNull();
  });

  it("never leaks into the CSV — the export takes brand names only", () => {
    const csv = buildQualifiedCreatorsCsv([
      { channelName: "A", youtubeChannelId: "UC1", sponsorBrands: ["Convex"], latestEligibleVideoAt: null },
    ]);
    expect(csv).not.toContain("watch?v=");
    expect(csv.split("\r\n")[0]).toBe("YouTuber Name,Channel URL,Niche,Sponsor Brands,Latest Video Date");
  });
});
