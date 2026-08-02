import { BRAND_INTRODUCING_PHRASES, SPONSOR_DISCLOSURE_PHRASES } from "./phrases";

export interface DisclosureMatch {
  phrase: string;
  context: string;
}

export interface ChapterTimestamp {
  label: string;
  seconds: number;
}

export interface DescriptionSignals {
  candidateBrands: string[];
  urls: string[];
  domains: string[];
  discountCodes: string[];
  campaignParameters: Record<string, string>;
  chapterTimestamps: ChapterTimestamp[];
  callsToAction: string[];
  disclosureMatches: DisclosureMatch[];
  hasExplicitSponsorDisclosure: boolean;
}

const URL_PATTERN = /https?:\/\/[^\s)"'<>\]]+/gi;
const DOMAIN_PATTERN = /\b([a-z0-9][a-z0-9-]*\.(?:[a-z0-9-]+\.)?(?:com|ai|io|co|net|org|dev|app|xyz|gg|tv|me|so|us))\b/gi;
const DISCOUNT_CODE_PATTERN = /\b(?:use code|discount code|promo code|code)[:\s]+["']?([A-Za-z0-9][A-Za-z0-9-]{1,19})["']?/gi;
const CHAPTER_LINE_PATTERN = /^\s*(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*[-–:]?\s*(.+)$/;
const CTA_KEYWORDS = ["try", "sign up", "get started", "use the link", "check out", "download", "free trial", "special offer", "learn more"];

function extractContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function timecodeToSeconds(timecode: string): number {
  const parts = timecode.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function extractCandidateBrands(description: string): string[] {
  const candidates = new Set<string>();

  for (const phrase of BRAND_INTRODUCING_PHRASES) {
    const lower = description.toLowerCase();
    let searchFrom = 0;
    let idx = lower.indexOf(phrase, searchFrom);
    while (idx !== -1) {
      const after = description.slice(idx + phrase.length);
      // Require a capitalised word (or acronym) immediately following the phrase — a
      // reasonable proper-noun heuristic that avoids over-matching generic prose.
      const match = after.match(/^[\s,:]*([A-Z][\w&.'-]*(?:\s+(?:of|the|and)?\s*[A-Z][\w&.'-]*){0,2})/);
      if (match) {
        let brand = match[1];
        // A period followed by whitespace is a sentence boundary, not part of the
        // brand — "sponsored by Nimbus. Try it free" must yield "Nimbus", never
        // "Nimbus. Try". (A trailing period with no following text is stripped below.)
        const sentenceEnd = brand.search(/\.\s/);
        if (sentenceEnd !== -1) brand = brand.slice(0, sentenceEnd);
        brand = brand.replace(/[.,!?'"]+$/, "").trim();
        if (brand.length > 1 && brand.length < 60) candidates.add(brand);
      }
      searchFrom = idx + phrase.length;
      idx = lower.indexOf(phrase, searchFrom);
    }
  }

  return Array.from(candidates);
}

function extractChapters(description: string): ChapterTimestamp[] {
  const chapters: ChapterTimestamp[] = [];
  for (const line of description.split(/\n/)) {
    const match = line.match(CHAPTER_LINE_PATTERN);
    if (!match) continue;
    const label = match[2].trim();
    if (!label) continue;
    chapters.push({ label, seconds: timecodeToSeconds(match[1]) });
  }
  return chapters;
}

function extractCampaignParameters(urls: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.forEach((value, key) => {
        if (/^(utm_|ref$|referral|aff|affiliate|campaign|promo)/i.test(key)) {
          params[key] = value;
        }
      });
    } catch {
      // Not a valid absolute URL — ignore.
    }
  }
  return params;
}

function extractDomains(description: string, urls: string[]): string[] {
  const domains = new Set<string>();
  for (const url of urls) {
    try {
      domains.add(new URL(url).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      // ignore invalid URL
    }
  }
  for (const match of description.matchAll(DOMAIN_PATTERN)) {
    domains.add(match[1].toLowerCase());
  }
  return Array.from(domains);
}

function extractCallsToAction(description: string): string[] {
  const sentences = description.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const ctas: string[] = [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (CTA_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      ctas.push(sentence);
    }
  }
  return ctas;
}

/**
 * Deterministically inspects a video description for sponsorship/commercial signals
 * before any AI model is invoked. Produces candidate brands and structured evidence
 * that is passed into the video-analysis loop and, later, the decision engine.
 * Findings here never automatically confirm a sponsorship on their own.
 */
export function analyseDescription(description: string): DescriptionSignals {
  const safeDescription = description ?? "";
  const lower = safeDescription.toLowerCase();

  const disclosureMatches: DisclosureMatch[] = [];
  for (const phrase of SPONSOR_DISCLOSURE_PHRASES) {
    let searchFrom = 0;
    let idx = lower.indexOf(phrase, searchFrom);
    while (idx !== -1) {
      disclosureMatches.push({ phrase, context: extractContext(safeDescription, idx, phrase.length) });
      searchFrom = idx + phrase.length;
      idx = lower.indexOf(phrase, searchFrom);
    }
  }

  const urls = Array.from(new Set(safeDescription.match(URL_PATTERN) ?? []));
  const domains = extractDomains(safeDescription, urls);
  const discountCodes = Array.from(
    new Set(Array.from(safeDescription.matchAll(DISCOUNT_CODE_PATTERN)).map((m) => m[1].toUpperCase())),
  );

  const explicitPhrases = new Set([
    "sponsored by",
    "sponsor of today's video",
    "sponsor of this video",
    "today's sponsor",
    "brought to you by",
    "paid partnership",
    "paid promotion",
    "thanks to",
    "thank you to",
  ]);

  return {
    candidateBrands: extractCandidateBrands(safeDescription),
    urls,
    domains,
    discountCodes,
    campaignParameters: extractCampaignParameters(urls),
    chapterTimestamps: extractChapters(safeDescription),
    callsToAction: extractCallsToAction(safeDescription),
    disclosureMatches,
    hasExplicitSponsorDisclosure: disclosureMatches.some((m) => explicitPhrases.has(m.phrase)),
  };
}
