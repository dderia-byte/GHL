import { toCsv } from "./csv";
import type { BrandTargetRecord, CreatorTargetRecord } from "./target-queries";

/**
 * Outreach-targeting CSV builders. Two audiences:
 *  - Creator targets: one row per creator — "who takes sponsorships, from whom, how
 *    often, how recently" — for pitching creators to brands.
 *  - Brand targets: one row per brand — "who is actively spending on creators in
 *    this niche, with whom" — for pitching brands on new creators.
 *
 * The "Outreach priority" column is a deterministic, explainable score (recency +
 * breadth + frequency of counted sponsorships) so rows can be sorted for a call
 * list; the "Priority signals" column states exactly why, and nothing in either
 * export is AI-generated except the clearly-labelled competitor suggestions.
 */

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / (24 * 3600 * 1000));
}

function channelUrl(youtubeChannelId: string): string {
  return `https://www.youtube.com/channel/${youtubeChannelId}`;
}

function videoUrl(youtubeVideoId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

interface PriorityResult {
  priority: "High" | "Medium" | "Low";
  signals: string;
}

function computePriority(options: {
  distinctBrandCount: number;
  lastDetectedAt: Date | null;
  confirmedCount: number;
  totalCount: number;
  now: Date;
}): PriorityResult {
  const signals: string[] = [];
  let score = 0;

  const recency = daysSince(options.lastDetectedAt, options.now);
  if (recency !== null && recency <= 30) {
    score += 2;
    signals.push(`sponsorship activity in the last 30 days`);
  } else if (recency !== null && recency <= 90) {
    score += 1;
    signals.push(`sponsorship activity in the last 90 days`);
  }

  if (options.distinctBrandCount >= 3) {
    score += 2;
    signals.push(`${options.distinctBrandCount} distinct brands`);
  } else if (options.distinctBrandCount === 2) {
    score += 1;
    signals.push(`2 distinct brands`);
  }

  if (options.confirmedCount > 0) {
    score += 1;
    signals.push(`${options.confirmedCount} human-confirmed detection(s)`);
  }

  if (options.totalCount >= 3) {
    score += 1;
    signals.push(`${options.totalCount} total placements`);
  }

  const priority = score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";
  return { priority, signals: signals.join("; ") || "limited signals so far" };
}

const CREATOR_HEADERS = [
  "Creator",
  "Channel URL",
  "Handle",
  "Subscribers",
  "Niche",
  "Source",
  "Discovered date",
  "Videos analysed",
  "Sponsored videos",
  "Sponsorship rate",
  "Distinct brands",
  "Brands (confirmed)",
  "Brands (pending review)",
  "Brand categories",
  "Placement types",
  "Discount codes seen",
  "Latest sponsor",
  "Latest sponsored video",
  "Latest sponsored video URL",
  "Latest detection date",
  "Avg confidence",
  "Outreach priority",
  "Priority signals",
];

export function buildCreatorTargetsCsv(records: CreatorTargetRecord[], now: Date = new Date()): string {
  const rows = records.map((record) => {
    const confirmed = record.detections.filter((d) => d.reviewStatus === "CONFIRMED" || d.reviewStatus === "EDITED");
    const pending = record.detections.filter((d) => d.reviewStatus === "PENDING");
    const latest = [...record.detections].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0] ?? null;
    const distinctBrands = unique(record.detections.map((d) => d.brandName));
    const avgConfidence = record.detections.length
      ? record.detections.reduce((sum, d) => sum + d.confidenceScore, 0) / record.detections.length
      : 0;
    const { priority, signals } = computePriority({
      distinctBrandCount: distinctBrands.length,
      lastDetectedAt: latest?.detectedAt ?? null,
      confirmedCount: confirmed.length,
      totalCount: record.detections.length,
      now,
    });

    return {
      Creator: record.channelName,
      "Channel URL": channelUrl(record.channelYoutubeId),
      Handle: record.handle ?? "",
      Subscribers: record.subscriberCount !== null ? Number(record.subscriberCount) : "",
      Niche: record.niche ?? "",
      Source: record.source,
      "Discovered date": formatDate(record.discoveredAt),
      "Videos analysed": record.videosAnalysed,
      "Sponsored videos": record.sponsoredVideos,
      "Sponsorship rate": record.videosAnalysed
        ? `${Math.round((record.sponsoredVideos / record.videosAnalysed) * 100)}%`
        : "",
      "Distinct brands": distinctBrands.length,
      "Brands (confirmed)": unique(confirmed.map((d) => d.brandName)).join("; "),
      "Brands (pending review)": unique(pending.map((d) => d.brandName)).join("; "),
      "Brand categories": unique(record.detections.map((d) => d.brandCategory)).join("; "),
      "Placement types": unique(record.detections.map((d) => d.placementType.replaceAll("_", " ").toLowerCase())).join("; "),
      "Discount codes seen": unique(record.detections.map((d) => d.discountCode)).join("; "),
      "Latest sponsor": latest?.brandName ?? "",
      "Latest sponsored video": latest?.videoTitle ?? "",
      "Latest sponsored video URL": latest ? videoUrl(latest.videoYoutubeId) : "",
      "Latest detection date": formatDate(latest?.detectedAt ?? null),
      "Avg confidence": record.detections.length ? `${Math.round(avgConfidence * 100)}%` : "",
      "Outreach priority": priority,
      "Priority signals": signals,
    };
  });

  // High priority first, then by subscriber count — a ready-made call list.
  const order = { High: 0, Medium: 1, Low: 2 } as const;
  rows.sort(
    (a, b) =>
      order[a["Outreach priority"] as keyof typeof order] - order[b["Outreach priority"] as keyof typeof order] ||
      Number(b.Subscribers || 0) - Number(a.Subscribers || 0),
  );

  return toCsv(CREATOR_HEADERS, rows);
}

const BRAND_HEADERS = [
  "Brand",
  "Domain",
  "Category",
  "Creators sponsored",
  "Creators (with subscribers)",
  "Discovery-sourced creators",
  "Total placements",
  "Confirmed placements",
  "Pending review",
  "Placement types",
  "Discount codes seen",
  "First seen",
  "Last seen",
  "Active in last 90 days",
  "Avg confidence",
  "Example video",
  "Example video URL",
  "Outreach priority",
  "Priority signals",
  "AI-suggested competitors (unverified)",
];

export function buildBrandTargetsCsv(records: BrandTargetRecord[], now: Date = new Date()): string {
  const rows = records.map((record) => {
    const confirmed = record.detections.filter((d) => d.reviewStatus === "CONFIRMED" || d.reviewStatus === "EDITED");
    const pending = record.detections.filter((d) => d.reviewStatus === "PENDING");
    const latest = [...record.detections].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0] ?? null;
    const first = [...record.detections].sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime())[0] ?? null;
    const creators = new Map<string, bigint | null>();
    for (const d of record.detections) {
      if (!creators.has(d.channelName)) creators.set(d.channelName, d.subscriberCount);
    }
    const discoverySourced = unique(
      record.detections.filter((d) => d.channelSource === "discovery").map((d) => d.channelName),
    );
    const avgConfidence = record.detections.length
      ? record.detections.reduce((sum, d) => sum + d.confidenceScore, 0) / record.detections.length
      : 0;
    const recency = daysSince(latest?.detectedAt ?? null, now);
    const { priority, signals } = computePriority({
      distinctBrandCount: creators.size, // for brands: breadth = distinct creators
      lastDetectedAt: latest?.detectedAt ?? null,
      confirmedCount: confirmed.length,
      totalCount: record.detections.length,
      now,
    });

    return {
      Brand: record.brandName,
      Domain: record.brandDomain ?? "",
      Category: record.brandCategory ?? "",
      "Creators sponsored": creators.size,
      "Creators (with subscribers)": Array.from(creators.entries())
        .map(([name, subs]) => (subs !== null ? `${name} (${Number(subs).toLocaleString("en-US")})` : name))
        .join("; "),
      "Discovery-sourced creators": discoverySourced.join("; "),
      "Total placements": record.detections.length,
      "Confirmed placements": confirmed.length,
      "Pending review": pending.length,
      "Placement types": unique(record.detections.map((d) => d.placementType.replaceAll("_", " ").toLowerCase())).join("; "),
      "Discount codes seen": unique(record.detections.map((d) => d.discountCode)).join("; "),
      "First seen": formatDate(first?.detectedAt ?? null),
      "Last seen": formatDate(latest?.detectedAt ?? null),
      "Active in last 90 days": recency !== null && recency <= 90 ? "yes" : "no",
      "Avg confidence": record.detections.length ? `${Math.round(avgConfidence * 100)}%` : "",
      "Example video": latest?.videoTitle ?? "",
      "Example video URL": latest ? videoUrl(latest.videoYoutubeId) : "",
      "Outreach priority": priority,
      "Priority signals": signals.replaceAll("distinct brands", "distinct creators"),
      "AI-suggested competitors (unverified)": record.competitorSuggestions.join("; "),
    };
  });

  const order = { High: 0, Medium: 1, Low: 2 } as const;
  rows.sort(
    (a, b) =>
      order[a["Outreach priority"] as keyof typeof order] - order[b["Outreach priority"] as keyof typeof order] ||
      Number(b["Total placements"]) - Number(a["Total placements"]),
  );

  return toCsv(BRAND_HEADERS, rows);
}
