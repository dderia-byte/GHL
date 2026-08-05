import { toCsv } from "./csv";
import { normaliseSponsorKey } from "@/lib/discovery/sponsor-qualification";

/**
 * The qualified-creators CSV: five columns, exactly one row per creator, no
 * explanations. Deliberately minimal — this file is a working outreach list, not a
 * report. There is no duplicate column: a creator either belongs in the file once,
 * or was already exported by an earlier run and is not in it at all.
 */

export interface QualifiedCreatorRecord {
  channelName: string;
  youtubeChannelId: string;
  /** @ handle when YouTube exposes one — the URL people actually recognise. */
  handle?: string | null;
  /** One concise primary category, derived from the creator's own content. */
  niche?: string | null;
  /** Every unique confirmed sponsor found across the analysed video window. */
  sponsorBrands: string[];
  latestEligibleVideoAt: Date | null;
}

const HEADERS = ["YouTuber Name", "Channel URL", "Niche", "Sponsor Brands", "Latest Video Date"];

export function formatVideoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Prefers the handle URL (youtube.com/@name), falls back to the channel-id URL. */
export function channelUrl(youtubeChannelId: string, handle?: string | null): string {
  const trimmed = handle?.trim();
  if (trimmed) return `https://www.youtube.com/${trimmed.startsWith("@") ? trimmed : `@${trimmed}`}`;
  return `https://www.youtube.com/channel/${youtubeChannelId}`;
}

/**
 * De-duplicates by normalised brand key so "PostHog" and "posthog.com" never both
 * appear, then joins with " | " for a single spreadsheet cell.
 */
export function formatSponsorBrands(brands: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const brand of brands) {
    const key = normaliseSponsorKey(brand);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(brand.trim());
  }
  return unique.join(" | ");
}

/**
 * Builds the CSV. Merging by channel id is done here as well as upstream so a caller
 * that hands the same creator over twice (found under two search keywords) still
 * produces one row with the union of their sponsors.
 */
export function buildQualifiedCreatorsCsv(records: QualifiedCreatorRecord[]): string {
  const byChannel = new Map<string, QualifiedCreatorRecord>();
  for (const record of records) {
    const existing = byChannel.get(record.youtubeChannelId);
    if (!existing) {
      byChannel.set(record.youtubeChannelId, record);
      continue;
    }
    byChannel.set(record.youtubeChannelId, {
      ...existing,
      handle: existing.handle ?? record.handle,
      niche: existing.niche ?? record.niche,
      sponsorBrands: [...existing.sponsorBrands, ...record.sponsorBrands],
      latestEligibleVideoAt:
        existing.latestEligibleVideoAt && record.latestEligibleVideoAt
          ? new Date(Math.max(existing.latestEligibleVideoAt.getTime(), record.latestEligibleVideoAt.getTime()))
          : (existing.latestEligibleVideoAt ?? record.latestEligibleVideoAt),
    });
  }

  const rows = Array.from(byChannel.values()).map((record) => ({
    "YouTuber Name": record.channelName,
    "Channel URL": channelUrl(record.youtubeChannelId, record.handle),
    Niche: record.niche ?? "",
    "Sponsor Brands": formatSponsorBrands(record.sponsorBrands),
    "Latest Video Date": formatVideoDate(record.latestEligibleVideoAt),
  }));
  return toCsv(HEADERS, rows);
}

/** qualified_creators_YYYY-MM-DD.csv */
export function qualifiedCreatorsFilename(now: Date = new Date()): string {
  return `qualified_creators_${now.toISOString().slice(0, 10)}.csv`;
}
