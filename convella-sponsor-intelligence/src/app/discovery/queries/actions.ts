"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import { discoveryQueryFormSchema } from "@/lib/validation/discovery";

export interface QueryActionState {
  error?: string;
  success?: boolean;
}

export async function createQueryAction(
  _prevState: QueryActionState | undefined,
  formData: FormData,
): Promise<QueryActionState> {
  const parsed = discoveryQueryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  const query = await prisma.discoveryQuery.create({
    data: {
      // label mirrors the search text: the column is kept for existing rows and for
      // display, but is no longer a separate thing to fill in.
      label: data.queryText,
      queryText: data.queryText,
      searchType: data.searchType,
      regionCode: data.regionCode,
      relevanceLanguage: data.relevanceLanguage,
      publishedWithinDays: data.publishedWithinDays,
      nicheKeywords: data.nicheKeywords,
      maxPages: data.maxPages,
      priority: data.priority,
      notes: data.notes,
    },
  });
  await recordAudit({
    actorType: "user",
    action: "discovery.query.created",
    entityType: "DiscoveryQuery",
    entityId: query.id,
    detail: { queryText: data.queryText },
  });
  revalidatePath("/discovery/queries");
  return { success: true };
}

export async function toggleQueryAction(queryId: string, enabled: boolean): Promise<QueryActionState> {
  await prisma.discoveryQuery.update({ where: { id: queryId }, data: { enabled } });
  await recordAudit({
    actorType: "user",
    action: enabled ? "discovery.query.enabled" : "discovery.query.disabled",
    entityType: "DiscoveryQuery",
    entityId: queryId,
  });
  revalidatePath("/discovery/queries");
  return { success: true };
}

export async function deleteQueryAction(queryId: string): Promise<QueryActionState> {
  const referenced = await prisma.discoveryCandidate.count({ where: { discoveryQueryId: queryId } });
  if (referenced > 0) {
    return {
      error: `This query found ${referenced} candidate(s) — disable it instead of deleting so their provenance is kept.`,
    };
  }
  await prisma.discoveryQuery.delete({ where: { id: queryId } });
  await recordAudit({
    actorType: "user",
    action: "discovery.query.deleted",
    entityType: "DiscoveryQuery",
    entityId: queryId,
  });
  revalidatePath("/discovery/queries");
  return { success: true };
}
