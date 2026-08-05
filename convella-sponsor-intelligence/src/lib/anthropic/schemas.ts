import { z } from "zod";
import { evidenceSourceValues } from "../video-analysis/types";

export const placementTypeValues = [
  "DEDICATED_VIDEO",
  "SPONSORED_INTEGRATION",
  "PRODUCT_PLACEMENT",
  "AFFILIATE_PROMOTION",
  "FREE_PRODUCT_OR_GIFTED",
  "ORGANIC_MENTION",
  "CHANNEL_PARTNERSHIP",
  "UNKNOWN",
] as const;

export const aiDetectionSchema = z.object({
  rawBrandName: z.string().min(1).max(120),
  canonicalBrandName: z.string().min(1).max(120),
  brandDomain: z.string().max(255).nullable(),
  brandCategory: z.string().max(120).nullable(),
  placementType: z.enum(placementTypeValues),
  startTimestampSeconds: z.number().int().nullable(),
  endTimestampSeconds: z.number().int().nullable(),
  evidenceText: z.string().min(1).max(2000),
  evidenceSource: z.enum(evidenceSourceValues),
  confidenceScore: z.number().min(0).max(1),
  reasoningSummary: z.string().min(1).max(2000),
  promotionalUrl: z.string().max(500).nullable(),
  discountCode: z.string().max(60).nullable(),
  callToAction: z.string().max(500).nullable(),
  sponsorshipConfirmed: z.boolean(),
});

export const aiClassificationResponseSchema = z.object({
  detections: z.array(aiDetectionSchema),
  noSponsorshipReason: z.string().max(1000).nullable(),
});

export type AiDetection = z.infer<typeof aiDetectionSchema>;
export type AiClassificationResponse = z.infer<typeof aiClassificationResponseSchema>;

export const competitorSuggestionSchema = z.object({
  suggestedBrandName: z.string().min(1).max(120),
  suggestedDomain: z.string().max(255).nullable(),
  category: z.string().max(120).nullable(),
  reason: z.string().min(1).max(1000),
  confidenceScore: z.number().min(0).max(1),
});

export const competitorSuggestionsResponseSchema = z.object({
  competitors: z.array(competitorSuggestionSchema).max(5),
});

export type CompetitorSuggestion = z.infer<typeof competitorSuggestionSchema>;
