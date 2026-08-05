import { prisma } from "@/lib/db";
import { findOrCreateBrand } from "@/lib/brand/service";
import type { PlacementType } from "@/generated/prisma/enums";

export async function confirmDetection(detectionId: string) {
  return prisma.sponsorshipDetection.update({
    where: { id: detectionId },
    data: { reviewStatus: "CONFIRMED", sponsorshipConfirmed: true, reviewedAt: new Date() },
  });
}

export async function rejectDetection(detectionId: string) {
  return prisma.sponsorshipDetection.update({
    where: { id: detectionId },
    data: { reviewStatus: "REJECTED", sponsorshipConfirmed: false, reviewedAt: new Date() },
  });
}

export async function markDetectionOrganic(detectionId: string) {
  return prisma.sponsorshipDetection.update({
    where: { id: detectionId },
    data: {
      reviewStatus: "ORGANIC",
      placementType: "ORGANIC_MENTION",
      sponsorshipConfirmed: false,
      reviewedAt: new Date(),
    },
  });
}

export async function markDetectionAffiliateOnly(detectionId: string) {
  return prisma.sponsorshipDetection.update({
    where: { id: detectionId },
    data: {
      reviewStatus: "EDITED",
      placementType: "AFFILIATE_PROMOTION",
      sponsorshipConfirmed: false,
      reviewedAt: new Date(),
    },
  });
}

export interface EditDetectionInput {
  rawBrandName?: string;
  placementType?: PlacementType;
  startTimestampSeconds?: number | null;
  endTimestampSeconds?: number | null;
  evidenceText?: string;
  promotionalUrl?: string | null;
  discountCode?: string | null;
  callToAction?: string | null;
  confidenceScore?: number;
}

export async function editDetection(detectionId: string, patch: EditDetectionInput) {
  return prisma.sponsorshipDetection.update({
    where: { id: detectionId },
    data: { ...patch, reviewStatus: "EDITED", reviewedAt: new Date() },
  });
}

export interface ManualDetectionInput {
  videoId: string;
  brandName: string;
  brandDomain?: string | null;
  placementType: PlacementType;
  startTimestampSeconds?: number | null;
  endTimestampSeconds?: number | null;
  evidenceText: string;
  promotionalUrl?: string | null;
  discountCode?: string | null;
  callToAction?: string | null;
}

/** Lets a human reviewer add a sponsor the automated analysis missed. */
export async function addManualDetection(input: ManualDetectionInput) {
  const brand = await findOrCreateBrand({
    rawBrandName: input.brandName,
    canonicalBrandName: input.brandName,
    domain: input.brandDomain ?? null,
    category: null,
  });

  return prisma.sponsorshipDetection.create({
    data: {
      videoId: input.videoId,
      brandId: brand.id,
      rawBrandName: input.brandName,
      placementType: input.placementType,
      startTimestampSeconds: input.startTimestampSeconds ?? null,
      endTimestampSeconds: input.endTimestampSeconds ?? null,
      evidenceText: input.evidenceText,
      evidenceSource: "MANUAL",
      confidenceScore: 1,
      reasoningSummary: "Manually added by a human reviewer.",
      promotionalUrl: input.promotionalUrl ?? null,
      discountCode: input.discountCode ?? null,
      callToAction: input.callToAction ?? null,
      sponsorshipConfirmed: true,
      reviewStatus: "CONFIRMED",
      reviewedAt: new Date(),
    },
  });
}

export async function markVideoNoSponsor(videoId: string) {
  return prisma.video.update({
    where: { id: videoId },
    data: { analysisStatus: "NO_SPONSOR_FOUND", stopReason: "marked_no_sponsor_by_reviewer", analysedAt: new Date() },
  });
}
