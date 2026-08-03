import { prisma } from "@/lib/db";
import type { CategoryWeight } from "@/lib/creator-profile/classification";
import { estimateSponsorshipRateUsd } from "./engine";
import type { MatchSignal, ScoreComponent } from "./types";

export interface MatchRow {
  id: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  brandId: string;
  brandName: string;
  matchScore: number;
  manualScore: number | null;
  confidenceScore: number;
  recommendation: string;
  explanation: string;
  components: ScoreComponent[];
  signals: MatchSignal[];
  scoredAt: Date;

  // Profile facts surfaced directly on the card so a decision needs no drill-down.
  medianViews: number | null;
  shortsRatio: number | null;
  uploadsPerMonth: number | null;
  primaryNiche: string | null;
  nicheWeights: CategoryWeight[];
  sponsorshipFrequency: number | null;
  repeatSponsorCount: number;
  businessEmail: string | null;
  lastResearchedAt: Date | null;
  estimatedRate: { low: number; high: number } | null;
  latestSponsors: string[];
  evidenceCount: number;
  /** Latest human decision, if any. */
  lastDecision: string | null;
}

function asArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export async function listBrandsWithMatches() {
  return prisma.brand.findMany({
    where: { creatorMatches: { some: {} } },
    select: { id: true, displayName: true, _count: { select: { creatorMatches: true } } },
    orderBy: { displayName: "asc" },
  });
}

export async function listMatches(options: { brandId?: string; minConfidence?: number } = {}): Promise<MatchRow[]> {
  const matches = await prisma.creatorBrandMatch.findMany({
    where: {
      ...(options.brandId ? { brandId: options.brandId } : {}),
      ...(options.minConfidence ? { confidenceScore: { gte: options.minConfidence } } : {}),
    },
    orderBy: [{ matchScore: "desc" }, { confidenceScore: "desc" }],
    take: 100,
    include: {
      brand: { select: { id: true, displayName: true } },
      channel: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          subscriberCount: true,
          profile: true,
        },
      },
    },
  });

  const channelIds = matches.map((m) => m.channelId);
  const [detections, feedback] = await Promise.all([
    channelIds.length
      ? prisma.sponsorshipDetection.findMany({
          where: { video: { channelId: { in: channelIds } }, reviewStatus: { in: ["PENDING", "CONFIRMED", "EDITED"] } },
          include: { brand: { select: { displayName: true } }, video: { select: { channelId: true } }, evidence: { select: { id: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [],
    channelIds.length
      ? prisma.creatorFeedback.findMany({
          where: { channelId: { in: channelIds } },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const sponsorsByChannel = new Map<string, string[]>();
  const evidenceByChannel = new Map<string, number>();
  for (const d of detections) {
    const list = sponsorsByChannel.get(d.video.channelId) ?? [];
    const name = d.brand?.displayName ?? d.rawBrandName;
    if (!list.includes(name)) list.push(name);
    sponsorsByChannel.set(d.video.channelId, list);
    evidenceByChannel.set(d.video.channelId, (evidenceByChannel.get(d.video.channelId) ?? 0) + d.evidence.length);
  }

  const decisionByChannel = new Map<string, string>();
  for (const f of feedback) {
    if (!decisionByChannel.has(f.channelId)) decisionByChannel.set(f.channelId, f.decision);
  }

  return matches.map((m) => {
    const profile = m.channel.profile;
    return {
      id: m.id,
      channelId: m.channelId,
      channelName: m.channel.name,
      thumbnailUrl: m.channel.thumbnailUrl,
      subscriberCount: m.channel.subscriberCount !== null ? Number(m.channel.subscriberCount) : null,
      brandId: m.brandId,
      brandName: m.brand.displayName,
      matchScore: m.matchScore,
      manualScore: m.manualScore,
      confidenceScore: m.confidenceScore,
      recommendation: m.recommendation,
      explanation: m.explanation,
      components: asArray<ScoreComponent>(m.components),
      signals: asArray<MatchSignal>(m.signals),
      scoredAt: m.scoredAt,

      medianViews: profile?.medianViewsLast25 ?? null,
      shortsRatio: profile?.shortsRatio ?? null,
      uploadsPerMonth: profile?.uploadsPerMonth ?? null,
      primaryNiche: profile?.primaryNiche ?? null,
      nicheWeights: asArray<CategoryWeight>(profile?.nicheWeights),
      sponsorshipFrequency: profile?.sponsorshipFrequency ?? null,
      repeatSponsorCount: profile?.repeatSponsorCount ?? 0,
      businessEmail: profile?.businessEmail ?? null,
      lastResearchedAt: profile?.computedAt ?? null,
      estimatedRate: estimateSponsorshipRateUsd(profile?.medianViewsLast25 ?? null),
      latestSponsors: (sponsorsByChannel.get(m.channelId) ?? []).slice(0, 4),
      evidenceCount: evidenceByChannel.get(m.channelId) ?? 0,
      lastDecision: decisionByChannel.get(m.channelId) ?? null,
    };
  });
}
