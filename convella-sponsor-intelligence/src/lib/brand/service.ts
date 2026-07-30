import { prisma } from "@/lib/db";
import { suggestCompetitors } from "@/lib/anthropic/reasoning-service";
import { findMatchingBrand } from "./normalize";

/**
 * Finds an existing brand matching the given name/domain (domain match takes priority
 * over name/alias match — see findMatchingBrand) or creates a new one. Uncertain fuzzy
 * matches are never auto-merged; a new brand is created instead and left for manual
 * brand-management review.
 */
export async function findOrCreateBrand(params: {
  rawBrandName: string;
  canonicalBrandName: string;
  domain: string | null;
  category: string | null;
}) {
  const existingBrands = await prisma.brand.findMany();
  const match = findMatchingBrand(params.rawBrandName, params.domain, existingBrands);
  if (match) {
    const aliases = new Set(match.aliases);
    if (!aliases.has(params.rawBrandName) && params.rawBrandName !== match.canonicalName) {
      aliases.add(params.rawBrandName);
    }
    return prisma.brand.update({
      where: { id: match.id },
      data: {
        aliases: Array.from(aliases),
        domain: match.domain ?? params.domain ?? undefined,
        category: match.category ?? params.category ?? undefined,
      },
    });
  }

  return prisma.brand.create({
    data: {
      canonicalName: params.canonicalBrandName,
      displayName: params.canonicalBrandName,
      domain: params.domain,
      category: params.category,
      aliases: params.rawBrandName !== params.canonicalBrandName ? [params.rawBrandName] : [],
    },
  });
}

/**
 * Refreshes AI-generated competitor suggestions for a brand. These are clearly
 * AI suggestions, not verified facts, and are never treated as confirmed sponsorship data.
 */
export async function refreshCompetitorSuggestionsForBrand(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const suggestions = await suggestCompetitors({
    canonicalName: brand.canonicalName,
    domain: brand.domain,
    category: brand.category,
  });

  if (suggestions.length === 0) return;

  await prisma.$transaction([
    prisma.brandCompetitorSuggestion.deleteMany({ where: { brandId } }),
    ...suggestions.map((s) =>
      prisma.brandCompetitorSuggestion.create({
        data: {
          brandId,
          suggestedBrandName: s.suggestedBrandName,
          suggestedDomain: s.suggestedDomain,
          reason: s.reason,
          confidenceScore: s.confidenceScore,
        },
      }),
    ),
  ]);
}
