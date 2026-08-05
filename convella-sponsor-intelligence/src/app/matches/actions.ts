"use server";

import { revalidatePath } from "next/cache";
import type { CreatorDecision } from "@/generated/prisma/enums";
import { rescoreBrandMatches } from "@/lib/matching/service";
import { recordCreatorFeedback } from "@/lib/matching/feedback";

export interface MatchActionState {
  error?: string;
  success?: boolean;
}

export async function rescoreBrandAction(brandId: string): Promise<MatchActionState> {
  try {
    const count = await rescoreBrandMatches(brandId);
    revalidatePath("/matches");
    return { success: count >= 0 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not rescore matches." };
  }
}

export async function recordDecisionAction(input: {
  channelId: string;
  brandId: string | null;
  decision: CreatorDecision;
  reason?: string;
  humanScore?: number;
}): Promise<MatchActionState> {
  try {
    await recordCreatorFeedback({
      channelId: input.channelId,
      brandId: input.brandId,
      decision: input.decision,
      reason: input.reason?.trim() || null,
      humanScore: Number.isFinite(input.humanScore) ? input.humanScore : null,
    });
    revalidatePath("/matches");
    revalidatePath("/matches/accuracy");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not record the decision." };
  }
}
