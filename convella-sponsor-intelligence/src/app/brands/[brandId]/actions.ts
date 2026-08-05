"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { refreshCompetitorSuggestionsForBrand } from "@/lib/brand/service";
import { refreshCreatorOpportunitiesForBrand } from "@/lib/brand/opportunities";
import { rescoreBrandMatches } from "@/lib/matching/service";

export async function updateBrandNotesAction(formData: FormData) {
  const brandId = String(formData.get("brandId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!brandId) return;
  await prisma.brand.update({ where: { id: brandId }, data: { notes } });
  revalidatePath(`/brands/${brandId}`);
}

export async function refreshBrandIntelligenceAction(brandId: string) {
  await Promise.all([refreshCompetitorSuggestionsForBrand(brandId), refreshCreatorOpportunitiesForBrand(brandId)]);
  // Evidence-based scoring (match + confidence + signals) runs after the legacy
  // opportunity pass so both views stay populated during the transition.
  await rescoreBrandMatches(brandId);
  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/matches");
}
