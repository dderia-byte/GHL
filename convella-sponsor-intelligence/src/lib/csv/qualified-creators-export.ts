import { toCsv } from "./csv";

/**
 * The qualified-creators CSV: five columns, one row per creator, no explanations.
 * Deliberately minimal — this file is a working list, not a report.
 */

export interface QualifiedCreatorRecord {
  channelName: string;
  youtubeChannelId: string;
  niche: string | null;
  sponsorBrands: string[];
  latestEligibleVideoAt: Date | null;
}

const HEADERS = ["YouTuber Name", "Channel URL", "Niche", "Sponsor Brands", "Latest Video Date"];

/** Concise primary niches. Anything unrecognised falls back to the stored label. */
const NICHE_CANONICAL: Record<string, string> = {
  ai: "AI",
  "ai developers": "AI",
  "ai coding tools": "AI",
  "ai tools": "AI",
  "artificial intelligence": "AI",
  "machine learning": "AI",
  programming: "Coding",
  "web development": "Coding",
  "tech entrepreneurship": "Tech Entrepreneurship",
  "indie hacking": "Tech Entrepreneurship",
  "self-hosting / homelab": "Open Source",
  "enterprise it professionals": "Cloud",
  "productivity users": "Automation",
  "ai automation users": "Automation",
  automation: "Automation",
  coding: "Coding",
  "software engineers": "Coding",
  devops: "DevOps",
  "devops / platform engineers": "DevOps",
  "cloud engineers": "Cloud",
  cloud: "Cloud",
  cybersecurity: "Cybersecurity",
  "cybersecurity professionals": "Cybersecurity",
  saas: "SaaS",
  "saas founders": "SaaS",
  "technical founders": "Tech Entrepreneurship",
  "open-source users": "Open Source",
  "open source": "Open Source",
  "developer tools": "Developer Tools",
  "data engineers / analysts": "Developer Tools",
  "no-code builders": "Automation",
};

/** Maps a stored niche label to one concise CSV value. */
export function toConciseNiche(raw: string | null): string {
  if (!raw) return "";
  const canonical = NICHE_CANONICAL[raw.trim().toLowerCase()];
  if (canonical) return canonical;
  // Unrecognised: keep it short rather than dumping a sentence into the cell.
  return raw.split(/[—(,]/)[0].trim().slice(0, 30);
}

export function formatVideoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function buildQualifiedCreatorsCsv(records: QualifiedCreatorRecord[]): string {
  const rows = records.map((record) => ({
    "YouTuber Name": record.channelName,
    "Channel URL": `https://www.youtube.com/channel/${record.youtubeChannelId}`,
    Niche: toConciseNiche(record.niche),
    // Max two brands — analysis stops once two unique sponsors are confirmed.
    "Sponsor Brands": record.sponsorBrands.slice(0, 2).join(" | "),
    "Latest Video Date": formatVideoDate(record.latestEligibleVideoAt),
  }));
  return toCsv(HEADERS, rows);
}

/** qualified_creators_YYYY-MM-DD.csv */
export function qualifiedCreatorsFilename(now: Date = new Date()): string {
  return `qualified_creators_${now.toISOString().slice(0, 10)}.csv`;
}
