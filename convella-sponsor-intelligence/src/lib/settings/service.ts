import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  SETTING_DEFINITIONS,
  resolveSettingValue,
  type DiscoverySettingsSnapshot,
  type SettingKey,
  type SettingValue,
} from "./definitions";

/**
 * Short-TTL cache so the worker's per-video pre-flight checks don't hit the
 * AppSetting table on every call, while operator edits still take effect within
 * seconds. The cache holds RAW stored rows; resolution (validation + fallbacks)
 * happens on every read so a bad row can never get pinned as a good value.
 */
const CACHE_TTL_MS = 15_000;

let cachedRows: Map<string, unknown> | null = null;
let cachedAt = 0;

async function getStoredRows(): Promise<Map<string, unknown>> {
  const now = Date.now();
  if (cachedRows && now - cachedAt < CACHE_TTL_MS) return cachedRows;
  const rows = await prisma.appSetting.findMany();
  cachedRows = new Map(rows.map((r) => [r.key, r.value as unknown]));
  cachedAt = now;
  return cachedRows;
}

/** Test hook + post-write invalidation. */
export function invalidateSettingsCache(): void {
  cachedRows = null;
  cachedAt = 0;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const rows = await getStoredRows();
  const definition = SETTING_DEFINITIONS[key];
  const envValue = definition.envFallback ? process.env[definition.envFallback] : undefined;
  return resolveSettingValue(key, rows.has(key) ? rows.get(key) : undefined, envValue);
}

/**
 * Writes a setting after validating against the key's schema (which encodes the
 * hard system bounds). Throws on an invalid value — callers surface the Zod message.
 */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  updatedBy?: string,
): Promise<void> {
  const definition = SETTING_DEFINITIONS[key];
  const parsed = definition.schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid value for setting ${key}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: parsed.data as Prisma.InputJsonValue, updatedBy },
    update: { value: parsed.data as Prisma.InputJsonValue, updatedBy },
  });
  invalidateSettingsCache();
}

/**
 * The frozen limits snapshot written to DiscoveryRun.settingsSnapshot at run start.
 * Everything a run's handlers consult mid-flight comes from this snapshot, never
 * from live settings — a mid-run edit affects the NEXT run only.
 */
export async function buildDiscoverySettingsSnapshot(): Promise<DiscoverySettingsSnapshot> {
  return {
    qualifiedTarget: await getSetting("discovery.qualifiedTarget"),
    maxCandidatesPerRun: await getSetting("discovery.maxCandidatesPerRun"),
    maxCreatorsPerRun: await getSetting("discovery.maxCreatorsPerRun"),
    maxConcurrentCreators: await getSetting("discovery.maxConcurrentCreators"),
    maxSubscribers: await getSetting("discovery.maxSubscribers"),
    allowHiddenSubscriberCounts: await getSetting("discovery.allowHiddenSubscriberCounts"),
    maxVideoAgeDays: await getSetting("discovery.maxVideoAgeDays"),
    rejectionCooldownDays: await getSetting("discovery.rejectionCooldownDays"),
    metadataOnlyDetection: await getSetting("discovery.metadataOnlyDetection"),
    transcriptFallbackEnabled: await getSetting("discovery.transcriptFallbackEnabled"),
    maxTranscriptSecondsPerVideo: await getSetting("discovery.maxTranscriptSecondsPerVideo"),
    geminiTextFallbackEnabled: await getSetting("discovery.geminiTextFallbackEnabled"),
    nativeVideoAnalysisEnabled: await getSetting("discovery.nativeVideoAnalysisEnabled"),
    maxPagesPerQuery: await getSetting("discovery.maxPagesPerQuery"),
    minIntervalHours: await getSetting("discovery.minIntervalHours"),
    dailyCostLimitUsd: await getSetting("budgets.dailyCostLimitUsd"),
    perRunCostLimitUsd: await getSetting("budgets.perRunCostLimitUsd"),
    dailyQuotaUnits: await getSetting("budgets.dailyQuotaUnits"),
  };
}
