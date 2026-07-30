"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { refreshCompetitorSuggestionsForBrand } from "@/lib/brand/service";
import { refreshCreatorOpportunitiesForBrand } from "@/lib/brand/opportunities";

export async function updateBrandNotesAction(formData: FormData) {
  const brandId = String(formData.get("brandId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!brandId) return;
  await prisma.brand.update({ where: { id: brandId }, data: { notes } });
  revalidatePath(`/brands/${brandId}`);
}

export async function refreshBrandIntelligenceAction(brandId: string) {
  await Promise.all([refreshCompetitorSuggestionsForBrand(brandId), refreshCreatorOpportunitiesForBrand(brandId)]);
  revalidatePath(`/brands/${brandId}`);
}
