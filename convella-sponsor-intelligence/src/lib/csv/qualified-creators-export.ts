import { toCsv } from "./csv";

/**
 * The qualified-creators CSV: five columns, one row per creator, no explanations.
 * Deliberately minimal — this file is a working list, not a report.
 */

export interface QualifiedCreatorRecord {
  channelName: string;
  youtubeChannelId: string;
  sponsorBrands: string[];
  latestEligibleVideoAt: Date | null;
  /**
   * True when this creator was already in the database (or had been rejected by an
   * earlier run) before the run that produced this row. Surfaced so nobody is
   * silently dropped on an older run's judgement — filter the column by hand.
   */
  previouslySeen?: boolean;
}

const HEADERS = ["YouTuber Name", "Channel URL", "Sponsor Brands", "Latest Video Date", "Duplicate"];

export function formatVideoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function buildQualifiedCreatorsCsv(records: QualifiedCreatorRecord[]): string {
  const rows = records.map((record) => ({
    "YouTuber Name": record.channelName,
    "Channel URL": `https://www.youtube.com/channel/${record.youtubeChannelId}`,
    // Max two brands — analysis stops once two unique sponsors are confirmed.
    "Sponsor Brands": record.sponsorBrands.slice(0, 2).join(" | "),
    "Latest Video Date": formatVideoDate(record.latestEligibleVideoAt),
    Duplicate: record.previouslySeen ? "Yes" : "No",
  }));
  return toCsv(HEADERS, rows);
}

/** qualified_creators_YYYY-MM-DD.csv */
export function qualifiedCreatorsFilename(now: Date = new Date()): string {
  return `qualified_creators_${now.toISOString().slice(0, 10)}.csv`;
}
