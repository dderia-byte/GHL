"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";
import { recordAudit } from "@/lib/audit/log";
import { discoverySettingsFormSchema } from "@/lib/validation/discovery";

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

export async function saveDiscoverySettingsAction(
  _prevState: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = discoverySettingsFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values and try again." };
  }
  const data = parsed.data;

  try {
    await setSetting("budgets.dailyCostLimitUsd", data.dailyCostLimitUsd);
    await setSetting("budgets.perRunCostLimitUsd", data.perRunCostLimitUsd);
    await setSetting("budgets.dailyQuotaUnits", data.dailyQuotaUnits);
    await setSetting("discovery.maxCreatorsPerRun", data.maxCreatorsPerRun);
    await setSetting("discovery.maxPagesPerQuery", data.maxPagesPerQuery);
    await setSetting("discovery.maxSubscribers", data.maxSubscribers);
    await setSetting("discovery.maxVideoAgeDays", data.maxVideoAgeDays);
    await setSetting("discovery.rejectionCooldownDays", data.rejectionCooldownDays);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save settings." };
  }

  await recordAudit({
    actorType: "user",
    action: "settings.discovery.updated",
    entityType: "AppSetting",
    entityId: "discovery",
    detail: { ...data },
  });
  revalidatePath("/settings");
  revalidatePath("/discovery");
  return { success: true };
}
