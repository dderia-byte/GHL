import { z } from "zod";

/**
 * Every operator-editable runtime setting: its Zod schema (which encodes the HARD
 * system bounds — the admin UI cannot exceed these no matter what), its default,
 * and an optional environment-variable fallback consulted when no AppSetting row
 * exists. Resolution order: AppSetting row → env fallback → default. A stored value
 * that fails its schema is treated as absent (defensive: a bad row must degrade to
 * the fallback, never crash the worker).
 */
export interface SettingDefinition<T> {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
  /** process.env name consulted when no (valid) AppSetting row exists. */
  envFallback?: string;
  description: string;
}

function def<T>(definition: SettingDefinition<T>): SettingDefinition<T> {
  return definition;
}

export const SETTING_DEFINITIONS = {
  "discovery.qualifiedTarget": def({
    key: "discovery.qualifiedTarget",
    schema: z.number().int().min(1).max(200),
    defaultValue: 30,
    envFallback: "DISCOVERY_QUALIFIED_TARGET",
    description: "How many NEW qualified creators (>=1 confirmed sponsor) a run collects before stopping.",
  }),
  "discovery.maxCandidatesPerRun": def({
    key: "discovery.maxCandidatesPerRun",
    schema: z.number().int().min(1).max(1000),
    defaultValue: 150,
    envFallback: "DISCOVERY_MAX_CANDIDATES_PER_RUN",
    description: "Hard ceiling on candidate creators analysed in one run, whether or not the target is met.",
  }),
  "discovery.maxCreatorsPerRun": def({
    key: "discovery.maxCreatorsPerRun",
    schema: z.number().int().min(1).max(200),
    defaultValue: 40,
    envFallback: "DISCOVERY_MAX_CREATORS_PER_RUN",
    description: "Candidates created per search pass (the run keeps searching until the qualified target or candidate ceiling is reached).",
  }),
  "discovery.maxConcurrentCreators": def({
    key: "discovery.maxConcurrentCreators",
    schema: z.number().int().min(1).max(4),
    defaultValue: 1,
    envFallback: "DISCOVERY_MAX_CONCURRENT_CREATORS",
    description: "Creators processed in parallel within a run (1 until the queue supports more).",
  }),
  "discovery.maxSubscribers": def({
    key: "discovery.maxSubscribers",
    schema: z.number().int().min(1),
    defaultValue: 800_000,
    envFallback: "DISCOVERY_MAX_SUBSCRIBERS",
    description: "Subscriber-count cap; channels above it are filtered out.",
  }),
  "discovery.allowHiddenSubscriberCounts": def({
    key: "discovery.allowHiddenSubscriberCounts",
    schema: z.boolean(),
    defaultValue: false,
    description: "Whether channels that hide subscriber counts pass the size filter (cap unverifiable).",
  }),
  "discovery.maxVideoAgeDays": def({
    key: "discovery.maxVideoAgeDays",
    schema: z.number().int().min(1).max(3650),
    defaultValue: 90,
    envFallback: "DISCOVERY_MAX_VIDEO_AGE_DAYS",
    description: "Channels whose newest upload is older than this are rejected as inactive.",
  }),
  "discovery.metadataOnlyDetection": def({
    key: "discovery.metadataOnlyDetection",
    schema: z.boolean(),
    defaultValue: true,
    envFallback: "DISCOVERY_METADATA_ONLY_DETECTION",
    description:
      "Accept a sponsor straight from the title/description/metadata when the disclosure is explicit, with no transcript and no paid model call.",
  }),
  "discovery.transcriptFallbackEnabled": def({
    key: "discovery.transcriptFallbackEnabled",
    schema: z.boolean(),
    defaultValue: true,
    envFallback: "DISCOVERY_TRANSCRIPT_FALLBACK",
    description:
      "Fetch a transcript when the metadata shows a promotional signal but does not conclusively name the sponsor.",
  }),
  "discovery.maxTranscriptSecondsPerVideo": def({
    key: "discovery.maxTranscriptSecondsPerVideo",
    schema: z.number().int().min(0).max(3600),
    defaultValue: 120,
    envFallback: "DISCOVERY_MAX_TRANSCRIPT_SECONDS",
    description:
      "Transcript seconds analysed per video. Covers the opening read plus short windows around detected brand names — never the full transcript.",
  }),
  "discovery.geminiTextFallbackEnabled": def({
    key: "discovery.geminiTextFallbackEnabled",
    schema: z.boolean(),
    defaultValue: false,
    envFallback: "DISCOVERY_GEMINI_TEXT_FALLBACK",
    description: "Allow a paid text-model call when metadata and the limited transcript are both inconclusive.",
  }),
  "discovery.nativeVideoAnalysisEnabled": def({
    key: "discovery.nativeVideoAnalysisEnabled",
    schema: z.boolean(),
    defaultValue: false,
    envFallback: "DISCOVERY_NATIVE_VIDEO_ANALYSIS",
    description:
      "Native video/audio/visual analysis during discovery runs. Off: it is by far the most expensive stage and discovery does not need it.",
  }),
  "discovery.rejectionCooldownDays": def({
    key: "discovery.rejectionCooldownDays",
    schema: z.number().int().min(0).max(3650),
    defaultValue: 30,
    envFallback: "DISCOVERY_REJECTION_COOLDOWN_DAYS",
    description:
      "Days a rejected channel is skipped before it may be analysed again. Kept short (30) because a creator with no sponsor today may have signed one next month.",
  }),
  "discovery.maxPagesPerQuery": def({
    key: "discovery.maxPagesPerQuery",
    schema: z.number().int().min(1).max(10),
    defaultValue: 2,
    envFallback: "DISCOVERY_MAX_PAGES_PER_QUERY",
    description:
      "search.list pages per query per run (each page = up to 50 results but far fewer unique channels, and costs 100 quota units).",
  }),
  "discovery.minIntervalHours": def({
    key: "discovery.minIntervalHours",
    schema: z.number().int().min(0).max(720),
    defaultValue: 20,
    envFallback: "DISCOVERY_MIN_INTERVAL_HOURS",
    description: "A query executed more recently than this is skipped (guards accidental quota re-spend).",
  }),
  "budgets.dailyCostLimitUsd": def({
    key: "budgets.dailyCostLimitUsd",
    schema: z.number().min(0).max(10_000),
    defaultValue: 25,
    envFallback: "BUDGET_DAILY_COST_LIMIT_USD",
    description: "Hard ceiling on estimated model spend per UTC day, across all runs.",
  }),
  "budgets.perRunCostLimitUsd": def({
    key: "budgets.perRunCostLimitUsd",
    schema: z.number().min(0).max(10_000),
    defaultValue: 1,
    envFallback: "BUDGET_PER_RUN_COST_LIMIT_USD",
    description: "Hard ceiling on estimated model spend for a single discovery run.",
  }),
  "budgets.dailyQuotaUnits": def({
    key: "budgets.dailyQuotaUnits",
    schema: z.number().int().min(0).max(1_000_000),
    defaultValue: 8_000,
    envFallback: "BUDGET_DAILY_QUOTA_UNITS",
    description:
      "YouTube API quota units discovery may spend per UTC day (leave headroom below the project's real quota for manual app usage).",
  }),
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFINITIONS)[K]["defaultValue"];

/** The frozen per-run limits snapshot stored on DiscoveryRun.settingsSnapshot. */
export interface DiscoverySettingsSnapshot {
  qualifiedTarget: number;
  maxCandidatesPerRun: number;
  maxCreatorsPerRun: number;
  maxConcurrentCreators: number;
  maxSubscribers: number;
  allowHiddenSubscriberCounts: boolean;
  maxVideoAgeDays: number;
  rejectionCooldownDays: number;
  metadataOnlyDetection: boolean;
  transcriptFallbackEnabled: boolean;
  maxTranscriptSecondsPerVideo: number;
  geminiTextFallbackEnabled: boolean;
  nativeVideoAnalysisEnabled: boolean;
  maxPagesPerQuery: number;
  minIntervalHours: number;
  dailyCostLimitUsd: number;
  perRunCostLimitUsd: number;
  dailyQuotaUnits: number;
}

/**
 * Pure resolution used by the service and tested directly: stored row value (if it
 * validates) → env fallback (if present and it validates after coercion) → default.
 */
export function resolveSettingValue<K extends SettingKey>(
  key: K,
  storedValue: unknown | undefined,
  envValue: string | undefined,
): SettingValue<K> {
  const definition = SETTING_DEFINITIONS[key];

  if (storedValue !== undefined) {
    const parsed = definition.schema.safeParse(storedValue);
    if (parsed.success) return parsed.data as SettingValue<K>;
  }

  if (envValue !== undefined && envValue !== "") {
    const coerced = coerceEnvValue(envValue, definition.defaultValue);
    const parsed = definition.schema.safeParse(coerced);
    if (parsed.success) return parsed.data as SettingValue<K>;
  }

  return definition.defaultValue as SettingValue<K>;
}

function coerceEnvValue(raw: string, defaultValue: unknown): unknown {
  if (typeof defaultValue === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (typeof defaultValue === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }
  return raw;
}
