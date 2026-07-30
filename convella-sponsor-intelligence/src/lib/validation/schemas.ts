import { z } from "zod";

export const analysisModeSchema = z.enum(["FIRST_SPONSOR_ONLY", "ALL_SPONSORS"]);
export const placementTypeSchema = z.enum([
  "DEDICATED_VIDEO",
  "SPONSORED_INTEGRATION",
  "PRODUCT_PLACEMENT",
  "AFFILIATE_PROMOTION",
  "FREE_PRODUCT_OR_GIFTED",
  "ORGANIC_MENTION",
  "CHANNEL_PARTNERSHIP",
  "UNKNOWN",
]);

export const addSourceSchema = z.object({
  input: z.string().trim().min(1, "Enter a channel URL, handle, channel ID, or video URL.").max(500),
  videoCount: z.coerce.number().int().min(1).max(50).default(20),
  analysisMode: analysisModeSchema.default("FIRST_SPONSOR_ONLY"),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  mediaPermissionAcknowledged: z.coerce.boolean().default(false),
});

export type AddSourceInput = z.infer<typeof addSourceSchema>;

export const pastedTranscriptSchema = z.object({
  videoId: z.string().cuid2().or(z.string().min(1)),
  text: z.string().trim().min(1, "Paste the transcript text.").max(500_000),
});

export const uploadedTranscriptSchema = z.object({
  videoId: z.string().min(1),
  filename: z.string().min(1).max(255),
  content: z.string().min(1).max(2_000_000),
});

export const editDetectionSchema = z.object({
  detectionId: z.string().min(1),
  videoId: z.string().min(1),
  rawBrandName: z.string().trim().min(1).max(200).optional(),
  placementType: placementTypeSchema.optional(),
  startTimestampSeconds: z.coerce.number().int().min(0).nullable().optional(),
  endTimestampSeconds: z.coerce.number().int().min(0).nullable().optional(),
  evidenceText: z.string().trim().max(2000).optional(),
  promotionalUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  discountCode: z.string().trim().max(60).nullable().optional(),
  callToAction: z.string().trim().max(500).nullable().optional(),
});

export const manualDetectionSchema = z.object({
  videoId: z.string().min(1),
  brandName: z.string().trim().min(1).max(200),
  brandDomain: z.string().trim().max(255).optional().or(z.literal("")),
  placementType: placementTypeSchema,
  startTimestampSeconds: z.coerce.number().int().min(0).nullable().optional(),
  endTimestampSeconds: z.coerce.number().int().min(0).nullable().optional(),
  evidenceText: z.string().trim().min(1).max(2000),
  promotionalUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  discountCode: z.string().trim().max(60).optional().or(z.literal("")),
  callToAction: z.string().trim().max(500).optional().or(z.literal("")),
});

export const channelNotesSchema = z.object({
  channelId: z.string().min(1),
  notes: z.string().trim().max(2000),
});
