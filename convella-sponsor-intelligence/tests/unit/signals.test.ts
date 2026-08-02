import { describe, expect, it } from "vitest";
import { analyseDescription } from "@/lib/signals/description";
import { analyseTranscriptSignals } from "@/lib/signals/transcript";
import { analyseYouTubeMetadata } from "@/lib/signals/metadata";

describe("analyseDescription", () => {
  it("extracts a candidate brand from an explicit sponsorship phrase", () => {
    const result = analyseDescription("Thanks to Greptile for sponsoring this video.");
    expect(result.candidateBrands).toContain("Greptile");
    expect(result.hasExplicitSponsorDisclosure).toBe(true);
  });

  it("stops brand capture at a sentence boundary", () => {
    // A capitalised word starting the NEXT sentence must not be absorbed into the brand.
    const result = analyseDescription("This video is sponsored by Nimbus Notes. Try Nimbus Notes free today.");
    expect(result.candidateBrands).toContain("Nimbus Notes");
    expect(result.candidateBrands).not.toContain("Nimbus Notes. Try");
  });

  it("still strips a plain trailing period from a brand at end of text", () => {
    const result = analyseDescription("This video is sponsored by Higgsfield.");
    expect(result.candidateBrands).toContain("Higgsfield");
  });

  it("extracts URLs and domains", () => {
    const result = analyseDescription("Try CodeRabbit free: https://coderabbit.ai/try and read the docs at docs.coderabbit.ai");
    expect(result.urls).toContain("https://coderabbit.ai/try");
    expect(result.domains).toContain("coderabbit.ai");
  });

  it("extracts discount codes", () => {
    const result = analyseDescription("Use code SAVE20 for a discount, or use our discount code LAUNCH10.");
    expect(result.discountCodes).toEqual(expect.arrayContaining(["SAVE20", "LAUNCH10"]));
  });

  it("extracts UTM campaign parameters", () => {
    const result = analyseDescription("Check it out: https://example.com/?utm_source=youtube&utm_campaign=launch");
    expect(result.campaignParameters.utm_source).toBe("youtube");
    expect(result.campaignParameters.utm_campaign).toBe("launch");
  });

  it("extracts chapter timestamps", () => {
    const result = analyseDescription("0:00 Intro\n1:30 Sponsor\n5:00 Main content");
    expect(result.chapterTimestamps).toEqual([
      { label: "Intro", seconds: 0 },
      { label: "Sponsor", seconds: 90 },
      { label: "Main content", seconds: 300 },
    ]);
  });

  it("does not mark implicit descriptions as an explicit disclosure", () => {
    const result = analyseDescription("Check out this cool gadget I found, link below in case you're curious.");
    expect(result.hasExplicitSponsorDisclosure).toBe(false);
  });

  it("extracts calls to action", () => {
    const result = analyseDescription("Try our free trial today! Sign up now to get started.");
    expect(result.callsToAction.length).toBeGreaterThan(0);
  });

  it("handles an empty description without throwing", () => {
    const result = analyseDescription("");
    expect(result.candidateBrands).toEqual([]);
    expect(result.hasExplicitSponsorDisclosure).toBe(false);
  });
});

describe("analyseTranscriptSignals", () => {
  it("finds sponsor disclosure phrases with their timestamps", () => {
    const matches = analyseTranscriptSignals([
      { text: "Hey everyone, welcome back", startSeconds: 0, durationSeconds: 3 },
      { text: "This video is sponsored by Acme Corp", startSeconds: 10, durationSeconds: 4 },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].timestampSeconds).toBe(10);
  });

  it("returns an empty array when there are no signals", () => {
    const matches = analyseTranscriptSignals([{ text: "Just a normal tutorial", startSeconds: 0, durationSeconds: 5 }]);
    expect(matches).toHaveLength(0);
  });
});

describe("analyseYouTubeMetadata", () => {
  it("surfaces the paid product placement flag", () => {
    const result = analyseYouTubeMetadata({ paidProductPlacement: true, tags: [], title: "My video" });
    expect(result.paidProductPlacement).toBe(true);
  });

  it("finds sponsor-related tags", () => {
    const result = analyseYouTubeMetadata({ paidProductPlacement: false, tags: ["cooking", "sponsored"], title: "x" });
    expect(result.matchingTags).toEqual(["sponsored"]);
  });
});
