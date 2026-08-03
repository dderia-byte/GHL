import { prisma } from "@/lib/db";
import { classifyContent } from "./classification";
import { extractContacts } from "./contacts";
import {
  computeCadence,
  computeCommercialStats,
  computeEngagement,
  computeViewStats,
  computeViewTrend,
  computeViewsPerSubscriber,
  sortNewestFirst,
  splitByFormat,
  type ProfileVideoInput,
} from "./metrics";

/** Detections in these states count as real commercial activity (REJECTED/ORGANIC do not). */
const COUNTED_REVIEW_STATUSES = ["PENDING", "CONFIRMED", "EDITED"] as const;

/**
 * Which profile fields must be present for the profile to be considered "complete".
 * Completeness feeds the confidence score — a recommendation built on a half-empty
 * profile must never present as being as reliable as one built on a full profile.
 */
const COMPLETENESS_FIELDS = [
  "avgViewsLast10",
  "medianViewsLast25",
  "engagementRate",
  "uploadsPerMonth",
  "viewTrendRatio",
  "sponsorshipFrequency",
  "primaryNiche",
  "businessEmail",
  "viewsPerSubscriber",
  "technicalDepth",
] as const;

/**
 * Rebuilds a creator's derived intelligence profile from stored videos and detections.
 *
 * Everything is computed from real records; nothing is inferred from subscriber count
 * and nothing is invented. Fields that cannot be computed stay null so the UI, exports
 * and scoring layer can report them honestly as "unknown".
 */
export async function buildCreatorProfile(channelId: string) {
  const channel = await prisma.channel.findUniqueOrThrow({
    where: { id: channelId },
    include: {
      videos: {
        orderBy: { publishedAt: "desc" },
        take: 100, // historical window cap — see docs/accuracy-audit.md §5
        include: {
          sponsorshipDetections: {
            where: { reviewStatus: { in: [...COUNTED_REVIEW_STATUSES] } },
            include: { brand: { select: { canonicalName: true } } },
          },
        },
      },
    },
  });

  const videoInputs: ProfileVideoInput[] = channel.videos.map((video) => ({
    id: video.id,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount !== null ? Number(video.viewCount) : null,
    likeCount: video.likeCount !== null ? Number(video.likeCount) : null,
    commentCount: null, // not currently fetched from the YouTube API
    publishedAt: video.publishedAt,
    hasSponsorship: video.sponsorshipDetections.length > 0,
    sponsorBrands: video.sponsorshipDetections.map((d) => d.brand?.canonicalName ?? d.rawBrandName),
  }));

  const { longForm, shorts, shortsRatio } = splitByFormat(videoInputs);
  const longFormNewestFirst = sortNewestFirst(longForm);

  const viewStats = computeViewStats(longFormNewestFirst);
  const engagement = computeEngagement(longForm);
  const cadence = computeCadence(longFormNewestFirst);
  const viewTrendRatio = computeViewTrend(longFormNewestFirst);
  const commercial = computeCommercialStats(longForm);
  const viewsPerSubscriber = computeViewsPerSubscriber(
    viewStats.medianViewsLast25,
    channel.subscriberCount !== null ? Number(channel.subscriberCount) : null,
  );

  // Classify from the creator's own long-form content (title + description +
  // transcript when we have one), newest 25 — the window that reflects their
  // current beat rather than what they made three years ago.
  const classificationSource = channel.videos
    .filter((v) => v.durationSeconds === null || v.durationSeconds > 180)
    .slice(0, 25);
  const documents = classificationSource.map((v) =>
    [v.title, v.description, v.transcriptText ?? ""].filter(Boolean).join("\n"),
  );
  const classification = classifyContent(documents);

  const contacts = extractContacts(
    channel.description,
    channel.videos.slice(0, 10).map((v) => v.description),
  );

  const profileData = {
    longFormVideoCount: longForm.length,
    shortsVideoCount: shorts.length,
    shortsRatio,

    avgViewsLast10: viewStats.avgViewsLast10,
    avgViewsLast25: viewStats.avgViewsLast25,
    medianViewsLast25: viewStats.medianViewsLast25,
    highestRecentViews: viewStats.highestRecentViews,
    lowestRecentViews: viewStats.lowestRecentViews,
    viewsPerSubscriber,

    avgLikes: engagement.avgLikes,
    avgComments: engagement.avgComments,
    engagementRate: engagement.engagementRate,

    uploadsPerMonth: cadence.uploadsPerMonth,
    daysSinceLastUpload: cadence.daysSinceLastUpload,
    uploadConsistency: cadence.uploadConsistency,
    viewTrendRatio,

    sponsorshipFrequency: commercial.sponsorshipFrequency,
    sponsoredVideoCount: commercial.sponsoredVideoCount,
    distinctSponsorCount: commercial.distinctSponsorCount,
    repeatSponsorCount: commercial.repeatSponsorCount,
    lastSponsorshipAt: commercial.lastSponsorshipAt,

    businessEmail: contacts.businessEmail,
    website: contacts.website,
    socialLinks: Object.keys(contacts.socialLinks).length
      ? JSON.parse(JSON.stringify({ links: contacts.socialLinks, sources: contacts.sources }))
      : undefined,

    primaryNiche: classification.primaryNiche,
    secondaryNiche: classification.secondaryNiche,
    nicheWeights: classification.nicheWeights.length
      ? JSON.parse(JSON.stringify(classification.nicheWeights))
      : undefined,
    recurringTopics: classification.recurringTopics,
    technicalDepth: classification.technicalDepth,

    videosConsidered: channel.videos.length,
    computedAt: new Date(),
  };

  const present = COMPLETENESS_FIELDS.filter((field) => {
    const value = (profileData as Record<string, unknown>)[field];
    return value !== null && value !== undefined;
  }).length;
  const profileCompleteness = present / COMPLETENESS_FIELDS.length;

  return prisma.creatorProfile.upsert({
    where: { channelId },
    create: { channelId, ...profileData, profileCompleteness },
    update: { ...profileData, profileCompleteness },
  });
}

/** Rebuilds profiles for every channel that has at least one stored video. */
export async function rebuildAllCreatorProfiles(): Promise<number> {
  const channels = await prisma.channel.findMany({
    where: { videos: { some: {} } },
    select: { id: true },
  });
  for (const channel of channels) {
    await buildCreatorProfile(channel.id);
  }
  return channels.length;
}
