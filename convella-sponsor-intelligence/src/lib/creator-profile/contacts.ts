/**
 * Extracts public contact routes from text the creator themselves published
 * (channel description, video descriptions). Nothing is inferred or guessed: a value
 * is only returned when it literally appears in the supplied text, so every contact
 * in an export is traceable to a real source string.
 */

export interface ExtractedContacts {
  businessEmail: string | null;
  website: string | null;
  socialLinks: Record<string, string>;
  /** Where each value was found, for audit ("channel description" / "video description"). */
  sources: Record<string, string>;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Emails sitting near these words are business contacts, not fan mail. */
const BUSINESS_EMAIL_HINTS = [
  "business",
  "sponsor",
  "partnership",
  "collab",
  "enquir",
  "inquir",
  "work with me",
  "contact",
  "press",
  "media",
  "booking",
];

/** Never surface these as a creator's own contact route. */
const EMAIL_DENYLIST = [/@youtube\./i, /@example\./i, /noreply/i, /no-reply/i];

const SOCIAL_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: "instagram", pattern: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i },
  { key: "twitter", pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i },
  { key: "linkedin", pattern: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9-_%]+/i },
  { key: "github", pattern: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9-]+/i },
  { key: "tiktok", pattern: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i },
  { key: "discord", pattern: /https?:\/\/(?:www\.)?discord\.(?:gg|com)\/[A-Za-z0-9-]+/i },
  { key: "patreon", pattern: /https?:\/\/(?:www\.)?patreon\.com\/[A-Za-z0-9-_]+/i },
  { key: "linktree", pattern: /https?:\/\/(?:www\.)?(?:linktr\.ee|beacons\.ai|bio\.link)\/[A-Za-z0-9-_.]+/i },
  { key: "newsletter", pattern: /https?:\/\/[A-Za-z0-9-]+\.(?:substack\.com|beehiiv\.com|convertkit\.com)[^\s)"'<>\]]*/i },
];

/** Hosts that are never a creator's "own website". */
const NON_WEBSITE_HOSTS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "github.com",
  "tiktok.com",
  "discord.gg",
  "discord.com",
  "patreon.com",
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "amzn.to",
  "bit.ly",
  "facebook.com",
  "reddit.com",
];

function isDenylisted(email: string): boolean {
  return EMAIL_DENYLIST.some((pattern) => pattern.test(email));
}

/** Picks the email most likely to be a business contact, preferring ones near business wording. */
function pickBusinessEmail(text: string): string | null {
  const matches = Array.from(text.matchAll(EMAIL_PATTERN))
    .map((m) => ({ email: m[0].replace(/[.,;:]+$/, ""), index: m.index ?? 0 }))
    .filter((m) => !isDenylisted(m.email));
  if (matches.length === 0) return null;

  const lower = text.toLowerCase();
  for (const match of matches) {
    const window = lower.slice(Math.max(0, match.index - 120), match.index);
    if (BUSINESS_EMAIL_HINTS.some((hint) => window.includes(hint))) return match.email;
  }
  // No business wording nearby: a "business"-style local part is the next best signal.
  const byLocalPart = matches.find((m) => /^(business|partnerships?|sponsor|contact|hello|hi|info|press)@/i.test(m.email));
  return (byLocalPart ?? matches[0]).email;
}

function pickWebsite(text: string): string | null {
  const urls = text.match(/https?:\/\/[^\s)"'<>\]]+/g) ?? [];
  for (const raw of urls) {
    const url = raw.replace(/[.,;:]+$/, "");
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (NON_WEBSITE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) continue;
      // Skip obvious affiliate/sponsor destinations — a sponsor's URL is not the creator's site.
      if (/\butm_|[?&](ref|aff|affiliate)=/i.test(url)) continue;
      return url;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * @param channelDescription the creator's channel "about" text (most authoritative)
 * @param videoDescriptions recent video descriptions (fallback source)
 */
export function extractContacts(channelDescription: string, videoDescriptions: string[] = []): ExtractedContacts {
  const sources: Record<string, string> = {};
  const socialLinks: Record<string, string> = {};

  const channelText = channelDescription ?? "";
  const videoText = videoDescriptions.join("\n");

  const businessEmail = pickBusinessEmail(channelText) ?? pickBusinessEmail(videoText);
  if (businessEmail) {
    sources.businessEmail = pickBusinessEmail(channelText) ? "channel description" : "video description";
  }

  const website = pickWebsite(channelText) ?? pickWebsite(videoText);
  if (website) {
    sources.website = pickWebsite(channelText) ? "channel description" : "video description";
  }

  for (const { key, pattern } of SOCIAL_PATTERNS) {
    const fromChannel = channelText.match(pattern)?.[0];
    const fromVideo = fromChannel ? undefined : videoText.match(pattern)?.[0];
    const found = fromChannel ?? fromVideo;
    if (found) {
      socialLinks[key] = found.replace(/[.,;:]+$/, "");
      sources[key] = fromChannel ? "channel description" : "video description";
    }
  }

  return { businessEmail, website, socialLinks, sources };
}
