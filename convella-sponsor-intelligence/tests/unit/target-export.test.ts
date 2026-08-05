import { describe, expect, it } from "vitest";
import { buildCreatorTargetsCsv, buildBrandTargetsCsv } from "@/lib/csv/target-export";
import type { BrandTargetRecord, CreatorTargetRecord } from "@/lib/csv/target-queries";

const NOW = new Date("2026-08-02T12:00:00Z");

function creatorRecord(overrides: Partial<CreatorTargetRecord> = {}): CreatorTargetRecord {
  return {
    channelName: "Fictional Creator",
    channelYoutubeId: "UCfictional0000000000000",
    handle: "@fictional",
    subscriberCount: 120000n,
    niche: "Developer tools",
    source: "discovery",
    discoveredAt: new Date("2026-07-01T00:00:00Z"),
    videosAnalysed: 5,
    sponsoredVideos: 2,
    detections: [
      {
        brandName: "Nimbus Notes",
        brandDomain: "nimbusnotes.example.com",
        brandCategory: "Productivity",
        placementType: "SPONSORED_INTEGRATION",
        reviewStatus: "CONFIRMED",
        confidenceScore: 0.97,
        discountCode: "NIMBUS10",
        videoYoutubeId: "vid00000001",
        videoTitle: "My workflow video",
        videoPublishedAt: new Date("2026-07-20T00:00:00Z"),
        detectedAt: new Date("2026-07-21T00:00:00Z"),
      },
      {
        brandName: "Aurora VPN",
        brandDomain: "auroravpn.example.com",
        brandCategory: "Software",
        placementType: "DEDICATED_VIDEO",
        reviewStatus: "PENDING",
        confidenceScore: 0.91,
        discountCode: null,
        videoYoutubeId: "vid00000002",
        videoTitle: "Privacy video",
        videoPublishedAt: new Date("2026-07-25T00:00:00Z"),
        detectedAt: new Date("2026-07-26T00:00:00Z"),
      },
    ],
    ...overrides,
  };
}

describe("buildCreatorTargetsCsv", () => {
  it("aggregates brands, splits confirmed vs pending, and computes rate", () => {
    const csv = buildCreatorTargetsCsv([creatorRecord()], NOW);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("Outreach priority");
    expect(row).toContain("Fictional Creator");
    expect(row).toContain("https://www.youtube.com/channel/UCfictional0000000000000");
    expect(row).toContain("40%"); // 2/5 sponsorship rate
    expect(row).toContain("Nimbus Notes"); // confirmed column
    expect(row).toContain("Aurora VPN"); // pending column
    expect(row).toContain("NIMBUS10");
    expect(row).toContain("https://www.youtube.com/watch?v=vid00000002"); // latest video URL
  });

  it("scores recent multi-brand confirmed creators High and stale single-brand ones Low", () => {
    const high = buildCreatorTargetsCsv([creatorRecord()], NOW);
    expect(high).toContain("High");

    const stale = creatorRecord({
      detections: [
        { ...creatorRecord().detections[0], reviewStatus: "PENDING", detectedAt: new Date("2025-01-01T00:00:00Z") },
      ],
    });
    const low = buildCreatorTargetsCsv([stale], NOW);
    expect(low.split("\r\n")[1]).toContain("Low");
  });

  it("sorts High priority rows before Low ones", () => {
    const stale = creatorRecord({
      channelName: "Stale Creator",
      detections: [
        { ...creatorRecord().detections[0], reviewStatus: "PENDING", detectedAt: new Date("2025-01-01T00:00:00Z") },
      ],
    });
    const csv = buildCreatorTargetsCsv([stale, creatorRecord()], NOW);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain("Fictional Creator");
    expect(lines[2]).toContain("Stale Creator");
  });

  it("escapes CSV-hostile values (formula injection stays neutralised)", () => {
    const hostile = creatorRecord({ channelName: "=SUM(A1:A9)" });
    const csv = buildCreatorTargetsCsv([hostile], NOW);
    expect(csv).toContain("'=SUM(A1:A9)");
  });
});

describe("buildBrandTargetsCsv", () => {
  const brand: BrandTargetRecord = {
    brandName: "Nimbus Notes",
    brandDomain: "nimbusnotes.example.com",
    brandCategory: "Productivity",
    competitorSuggestions: ["Fictional Rival Notes"],
    detections: [
      {
        channelName: "Creator A",
        channelYoutubeId: "UCaaa",
        subscriberCount: 100000n,
        channelSource: "discovery",
        placementType: "SPONSORED_INTEGRATION",
        reviewStatus: "CONFIRMED",
        confidenceScore: 0.95,
        discountCode: "NIMBUS10",
        videoYoutubeId: "vidA",
        videoTitle: "Video A",
        detectedAt: new Date("2026-07-20T00:00:00Z"),
      },
      {
        channelName: "Creator B",
        channelYoutubeId: "UCbbb",
        subscriberCount: 50000n,
        channelSource: "manual",
        placementType: "SPONSORED_INTEGRATION",
        reviewStatus: "PENDING",
        confidenceScore: 0.9,
        discountCode: null,
        videoYoutubeId: "vidB",
        videoTitle: "Video B",
        detectedAt: new Date("2026-07-28T00:00:00Z"),
      },
    ],
  };

  it("aggregates creators with subscriber counts and recency", () => {
    const csv = buildBrandTargetsCsv([brand], NOW);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("AI-suggested competitors (unverified)");
    expect(row).toContain("Creator A (100,000)");
    expect(row).toContain("Creator B (50,000)");
    expect(row).toContain("Fictional Rival Notes");

    const headerCells = parseCsvLine(header);
    const cells = parseCsvLine(row);
    const cell = (name: string) => cells[headerCells.findIndex((h) => h.includes(name))];

    // Discovery-sourced column lists only the discovery-sourced creator.
    expect(cell("Discovery-sourced")).toBe("Creator A");
    expect(cell("Creators sponsored")).toBe("2");
    expect(cell("Confirmed placements")).toBe("1");
    expect(cell("Pending review")).toBe("1");
    expect(cell("Active in last 90 days")).toBe("yes");
  });

  it("marks a brand inactive when its last placement is over 90 days old", () => {
    const stale: BrandTargetRecord = {
      ...brand,
      detections: brand.detections.map((d) => ({ ...d, detectedAt: new Date("2025-01-01T00:00:00Z") })),
    };
    const csv = buildBrandTargetsCsv([stale], NOW);
    const headerCells = parseCsvLine(csv.split("\r\n")[0]);
    const cells = parseCsvLine(csv.split("\r\n")[1]);
    expect(cells[headerCells.indexOf("Active in last 90 days")]).toBe("no");
  });
});

/** Minimal RFC4180 line parser — cells may contain commas inside quotes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
