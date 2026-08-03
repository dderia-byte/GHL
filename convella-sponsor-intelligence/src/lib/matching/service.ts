import { prisma } from "@/lib/db";
import { buildCreatorProfile } from "@/lib/creator-profile/build";
import type { CategoryWeight } from "@/lib/creator-profile/classification";
import { scoreMatch, type MatchBrandInput, type MatchCreatorInput } from "./engine";
import { DEFAULT_MATCH_WEIGHTS, type MatchWeights } from "./types";

const COUNTED_REVIEW_STATUSES = ["PENDING", "CONFIRMED", "EDITED"] as const;

/** Profiles older than this are rebuilt before scoring, so matches use fresh evidence. */
const PROFILE_STALE_AFTER_MS = 7 * 24 * 3600 * 1000;

function parseNicheWeights(raw: unknown): CategoryWeight[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (w): w is CategoryWeight =>
      typeof w === "object" && w !== null && "key" in w && "label" in w && "weight" in w,
  );
}

/** Assembles the scoring input for one channel from its stored profile and detections. */
export async function buildMatchCreatorInput(channelId: string): Promise<MatchCreatorInput | null> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { profile: true },
  });
  if (!channel) return null;

  // Rebuild a missing or stale profile rather than scoring on outdated evidence.
  let profile = channel.profile;
  if (!profile || Date.now() - profile.computedAt.getTime() > PROFILE_STALE_AFTER_MS) {
    profile = await buildCreatorProfile(channelId);
  }

  const detections = await prisma.sponsorshipDetection.findMany({
    where: { video: { channelId }, reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } },
    include: { brand: true, evidence: { select: { id: true } } },
  });

  const sponsorsByName = new Map<string, { name: string; domain: string | null; category: string | null }>();
  for (const d of detections) {
    const name = d.brand?.displayName ?? d.rawBrandName;
    if (!sponsorsByName.has(name)) {
      sponsorsByName.set(name, { name, domain: d.brand?.domain ?? null, category: d.brand?.category ?? null });
    }
  }

  const transcriptAvailable = (await prisma.video.count({
    where: { channelId, transcriptStatus: "AVAILABLE" },
  })) > 0;

  return {
    channelName: channel.name,
    subscriberCount: channel.subscriberCount !== null ? Number(channel.subscriberCount) : null,
    nicheWeights: parseNicheWeights(profile.nicheWeights),
    recurringTopics: profile.recurringTopics,
    technicalDepth: (profile.technicalDepth as MatchCreatorInput["technicalDepth"]) ?? null,

    medianViewsLast25: profile.medianViewsLast25,
    avgViewsLast10: profile.avgViewsLast10,
    shortsRatio: profile.shortsRatio,
    viewsPerSubscriber: profile.viewsPerSubscriber,
    engagementRate: profile.engagementRate,
    uploadsPerMonth: profile.uploadsPerMonth,
    uploadConsistency: profile.uploadConsistency,
    viewTrendRatio: profile.viewTrendRatio,
    daysSinceLastUpload: profile.daysSinceLastUpload,

    sponsorshipFrequency: profile.sponsorshipFrequency,
    sponsoredVideoCount: profile.sponsoredVideoCount,
    distinctSponsorCount: profile.distinctSponsorCount,
    repeatSponsorCount: profile.repeatSponsorCount,
    pastSponsors: Array.from(sponsorsByName.values()),

    businessEmail: profile.businessEmail,
    profileCompleteness: profile.profileCompleteness,
    videosConsidered: profile.videosConsidered,
    evidenceCount: detections.reduce((sum, d) => sum + d.evidence.length, 0),
    transcriptAvailable,
    computedAt: profile.computedAt,
  };
}

export async function getMatchWeights(): Promise<MatchWeights> {
  const row = await prisma.appSetting.findUnique({ where: { key: "matching.weights" } });
  if (!row || typeof row.value !== "object" || row.value === null) return DEFAULT_MATCH_WEIGHTS;
  return { ...DEFAULT_MATCH_WEIGHTS, ...(row.value as Partial<MatchWeights>) };
}

/** Scores one creator against one brand and persists the result with its evidence. */
export async function scoreAndStoreMatch(channelId: string, brandId: string) {
  const [creatorInput, brand, weights] = await Promise.all([
    buildMatchCreatorInput(channelId),
    prisma.brand.findUnique({ where: { id: brandId } }),
    getMatchWeights(),
  ]);
  if (!creatorInput || !brand) return null;

  const brandInput: MatchBrandInput = {
    name: brand.displayName,
    domain: brand.domain,
    category: brand.category,
    maxBudgetUsd: null,
  };

  const result = scoreMatch(creatorInput, brandInput, weights);

  return prisma.creatorBrandMatch.upsert({
    where: { channelId_brandId: { channelId, brandId } },
    create: {
      channelId,
      brandId,
      matchScore: result.matchScore,
      confidenceScore: result.confidenceScore,
      recommendation: result.recommendation,
      components: JSON.parse(JSON.stringify(result.components)),
      signals: JSON.parse(JSON.stringify(result.signals)),
      explanation: result.explanation,
      weightsUsed: JSON.parse(JSON.stringify(weights)),
      scoredAt: new Date(),
    },
    update: {
      matchScore: result.matchScore,
      confidenceScore: result.confidenceScore,
      recommendation: result.recommendation,
      components: JSON.parse(JSON.stringify(result.components)),
      signals: JSON.parse(JSON.stringify(result.signals)),
      explanation: result.explanation,
      weightsUsed: JSON.parse(JSON.stringify(weights)),
      scoredAt: new Date(),
    },
  });
}

/**
 * Rescores every known creator against one brand. Creators the brand has already
 * sponsored are skipped — they are an existing relationship, not an opportunity.
 */
export async function rescoreBrandMatches(brandId: string): Promise<number> {
  const alreadySponsored = new Set(
    (
      await prisma.sponsorshipDetection.findMany({
        where: { brandId, reviewStatus: { in: ["CONFIRMED", "EDITED"] } },
        select: { video: { select: { channelId: true } } },
      })
    ).map((d) => d.video.channelId),
  );

  const channels = await prisma.channel.findMany({
    where: { videos: { some: {} } },
    select: { id: true },
  });

  let scored = 0;
  for (const channel of channels) {
    if (alreadySponsored.has(channel.id)) continue;
    await scoreAndStoreMatch(channel.id, brandId);
    scored += 1;
  }
  return scored;
}
