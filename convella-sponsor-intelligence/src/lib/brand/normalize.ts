const LEGAL_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "plc",
  "gmbh",
  "srl",
];

/** Lowercases, strips punctuation/legal suffixes, and collapses whitespace for comparison purposes. */
export function slugifyBrandToken(raw: string): string {
  const withoutSuffixes = raw
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !LEGAL_SUFFIXES.includes(word))
    .join(" ");

  return withoutSuffixes
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Extracts the registrable label from a domain, e.g. "coderabbit.ai" -> "coderabbit". */
export function domainLabel(domain: string): string {
  const host = domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  const parts = host.split(".");
  if (parts.length <= 1) return slugifyBrandToken(host);
  return slugifyBrandToken(parts[0]);
}

/**
 * Whether a domain plausibly belongs to a brand name, based on the registrable label
 * matching the slugified brand name (exact match, or one containing the other with a
 * minimum length guard to avoid trivial false positives like "a" matching everything).
 */
export function domainMatchesBrand(domain: string, brandName: string): boolean {
  const label = domainLabel(domain);
  const brandSlug = slugifyBrandToken(brandName);
  if (!label || !brandSlug || label.length < 3 || brandSlug.length < 3) return label === brandSlug;
  return label === brandSlug || label.includes(brandSlug) || brandSlug.includes(label);
}

export interface BrandMatchCandidate {
  canonicalName: string;
  domain: string | null;
  aliases: string[];
}

/**
 * Finds an existing brand that a raw brand name/domain should merge into. Domain
 * matches are authoritative; otherwise falls back to an exact (slugified) name or
 * alias match. Never merges purely on fuzzy text similarity — ambiguous cases should
 * be queued for manual review rather than guessed at.
 */
export function findMatchingBrand<T extends BrandMatchCandidate>(
  rawBrandName: string,
  rawDomain: string | null,
  existingBrands: T[],
): T | null {
  if (rawDomain) {
    const domainMatch = existingBrands.find((b) => b.domain && domainLabel(b.domain) === domainLabel(rawDomain));
    if (domainMatch) return domainMatch;
  }

  const targetSlug = slugifyBrandToken(rawBrandName);
  if (!targetSlug) return null;

  const nameMatch = existingBrands.find(
    (b) => slugifyBrandToken(b.canonicalName) === targetSlug || b.aliases.some((alias) => slugifyBrandToken(alias) === targetSlug),
  );

  return nameMatch ?? null;
}
