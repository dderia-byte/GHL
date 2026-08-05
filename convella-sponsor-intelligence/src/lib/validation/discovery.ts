import { z } from "zod";

/** Create/edit form for a discovery search query. */
export const discoveryQueryFormSchema = z.object({
  // The search text doubles as the query's label — one field, no duplicate naming.
  queryText: z.string().trim().min(2, "Enter the YouTube search text.").max(200),
  searchType: z.enum(["video", "channel"]).default("video"),
  regionCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Region must be a two-letter code, e.g. US or GB.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  relevanceLanguage: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}(-[a-z]{2})?$/i, "Language must be a code like en or en-gb.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publishedWithinDays: z.coerce.number().int().min(1).max(3650).optional().or(z.literal("").transform(() => undefined)),
  maxPages: z.coerce.number().int().min(1).max(5).default(1),
  priority: z.coerce.number().int().min(0).max(999).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
});

/** The editable budget/limit settings exposed on the settings page. */
export const discoverySettingsFormSchema = z.object({
  dailyCostLimitUsd: z.coerce.number().min(0).max(10_000),
  perRunCostLimitUsd: z.coerce.number().min(0).max(10_000),
  dailyQuotaUnits: z.coerce.number().int().min(0).max(1_000_000),
  maxCreatorsPerRun: z.coerce.number().int().min(1).max(100),
  maxPagesPerQuery: z.coerce.number().int().min(1).max(10),
  maxGatingPaidVideos: z.coerce.number().int().min(0).max(5),
  deepScanVideoCount: z.coerce.number().int().min(1).max(10),
  maxSubscribers: z.coerce.number().int().min(1),
  maxVideoAgeDays: z.coerce.number().int().min(1).max(3650),
  rejectionCooldownDays: z.coerce.number().int().min(0).max(3650),
  // HTML checkboxes submit "on" when ticked and are absent when not.
  includePreviouslySeenCreators: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});
