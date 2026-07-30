import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv/csv";
import { buildDetectionsCsv, type DetectionExportRecord } from "@/lib/csv/detections-export";

describe("toCsv", () => {
  it("escapes fields containing commas, quotes and newlines", () => {
    const csv = toCsv(["A", "B"], [{ A: 'has "quotes", and, commas', B: "line1\nline2" }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('"has ""quotes"", and, commas","line1\nline2"');
  });

  it("prevents CSV formula injection by prefixing risky leading characters", () => {
    const csv = toCsv(["Value"], [
      { Value: "=cmd|'/c calc'!A1" },
      { Value: "+1+1" },
      { Value: "-2+3" },
      { Value: "@SUM(A1:A2)" },
    ]);
    const rows = csv.split("\r\n").slice(1);
    expect(rows[0]).toBe("'=cmd|'/c calc'!A1");
    expect(rows[1]).toBe("'+1+1");
    expect(rows[2]).toBe("'-2+3");
    expect(rows[3]).toBe("'@SUM(A1:A2)");
  });

  it("leaves ordinary text untouched", () => {
    const csv = toCsv(["Value"], [{ Value: "Just a normal brand name" }]);
    expect(csv.split("\r\n")[1]).toBe("Just a normal brand name");
  });

  it("renders null/undefined as an empty cell", () => {
    const csv = toCsv(["Value"], [{ Value: null }, { Value: undefined }]);
    expect(csv.split("\r\n").slice(1)).toEqual(["", ""]);
  });
});

describe("buildDetectionsCsv", () => {
  const baseRecord: DetectionExportRecord = {
    channelName: "Modern Dev Weekly",
    channelYoutubeId: "UCabc",
    videoTitle: "A video",
    videoYoutubeId: "vid1234567",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    viewCount: 1000,
    brandDisplayName: "CodeRabbit",
    brandDomain: "coderabbit.ai",
    brandCategory: "Developer Tools",
    placementType: "SPONSORED_INTEGRATION",
    startTimestampSeconds: 45,
    endTimestampSeconds: 100,
    evidence: [
      { source: "VIDEO_AUDIO", text: "Thanks to CodeRabbit for sponsoring." },
      { source: "DESCRIPTION", text: "https://coderabbit.ai" },
    ],
    confidenceScore: 0.97,
    reviewStatus: "CONFIRMED",
    promotionalUrl: "https://coderabbit.ai",
    discountCode: null,
    secondsAnalysed: 120,
    chunksProcessed: 2,
    stopReason: "first_sponsor_confirmed",
    detectedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("includes a timestamped video URL and buckets evidence by source", () => {
    const csv = buildDetectionsCsv([baseRecord]);
    expect(csv).toContain("https://www.youtube.com/watch?v=vid1234567&t=45s");
    expect(csv).toContain("Thanks to CodeRabbit for sponsoring.");
  });

  it("escapes a malicious brand name so it cannot execute as a spreadsheet formula", () => {
    const malicious: DetectionExportRecord = { ...baseRecord, brandDisplayName: "=HYPERLINK(\"evil\")" };
    const csv = buildDetectionsCsv([malicious]);
    expect(csv).toContain("'=HYPERLINK(\"\"evil\"\")");
  });
});
