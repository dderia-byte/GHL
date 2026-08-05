/**
 * FICTIONAL DEMONSTRATION DATA ONLY.
 *
 * Every channel, video, brand, and sponsorship detection created by this script is
 * invented for demonstration purposes. None of it reflects real creators, real
 * brands, or real sponsorship relationships. Do not treat any of it as real
 * commercial intelligence.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { refreshCreatorOpportunitiesForBrand } from "../src/lib/brand/opportunities";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const FICTIONAL_NOTE = "[FICTIONAL DEMO DATA] Not a real creator/brand/sponsorship.";

async function main() {
  console.log("Seeding fictional demonstration data...");

  await prisma.creatorOpportunity.deleteMany();
  await prisma.brandCompetitorSuggestion.deleteMany();
  await prisma.sponsorEvidence.deleteMany();
  await prisma.sponsorshipDetection.deleteMany();
  await prisma.analysisJob.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.video.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.channel.deleteMany();

  // --- Brands (fictional) -----------------------------------------------
  const pixelforge = await prisma.brand.create({
    data: {
      canonicalName: "Pixelforge Cloud",
      displayName: "Pixelforge Cloud",
      domain: "pixelforgecloud.dev",
      category: "Developer Tools",
      aliases: ["Pixelforge", "PixelforgeCloud"],
    },
  });
  const brewtide = await prisma.brand.create({
    data: {
      canonicalName: "Brewtide Coffee Co.",
      displayName: "Brewtide Coffee Co.",
      domain: "brewtidecoffee.com",
      category: "Food & Beverage",
      aliases: ["Brewtide", "Brewtide Coffee"],
    },
  });
  const torqueline = await prisma.brand.create({
    data: {
      canonicalName: "Torqueline Tools",
      displayName: "Torqueline Tools",
      domain: "torquelinetools.com",
      category: "Automotive Tools",
      aliases: ["Torqueline"],
    },
  });
  const lumenHabits = await prisma.brand.create({
    data: {
      canonicalName: "Lumen Habits",
      displayName: "Lumen Habits",
      domain: "lumenhabits.co",
      category: "Health & Wellness",
      aliases: ["Lumen"],
    },
  });

  await prisma.brandCompetitorSuggestion.createMany({
    data: [
      {
        brandId: pixelforge.id,
        suggestedBrandName: "Northwind DevOps",
        suggestedDomain: "northwinddevops.io",
        reason: "AI suggestion (seed demo): similarly positioned developer-tooling platform targeting the same audience of backend engineers.",
        confidenceScore: 0.6,
      },
      {
        brandId: pixelforge.id,
        suggestedBrandName: "Stackharbor",
        suggestedDomain: null,
        reason: "AI suggestion (seed demo): frequently mentioned alongside Pixelforge Cloud in developer-tool comparison content.",
        confidenceScore: 0.45,
      },
    ],
  });

  // --- Channels (fictional creators) -------------------------------------
  const modernDevWeekly = await prisma.channel.create({
    data: {
      youtubeChannelId: "UCFICT0DEVWEEKLY00000001",
      handle: "@moderndevweekly",
      name: "Modern Dev Weekly",
      description: `${FICTIONAL_NOTE} A fictional channel covering software engineering tutorials and tool reviews.`,
      thumbnailUrl: null,
      subscriberCount: 184_000n,
      totalVideoCount: 312,
      category: "Software Development",
      notes: FICTIONAL_NOTE,
      lastScannedAt: new Date(),
    },
  });

  const kitchenWithKayla = await prisma.channel.create({
    data: {
      youtubeChannelId: "UCFICT0KITCHENKAYLA000002",
      handle: "@kitchenwithkayla",
      name: "Kitchen With Kayla",
      description: `${FICTIONAL_NOTE} A fictional home-cooking channel.`,
      thumbnailUrl: null,
      subscriberCount: 92_000n,
      totalVideoCount: 210,
      category: "Food & Cooking",
      notes: FICTIONAL_NOTE,
      lastScannedAt: new Date(),
    },
  });

  const gearheadGarage = await prisma.channel.create({
    data: {
      youtubeChannelId: "UCFICT0GEARHEADGARAGE0003",
      handle: "@gearheadgarage",
      name: "Gearhead Garage",
      description: `${FICTIONAL_NOTE} A fictional automotive restoration channel.`,
      thumbnailUrl: null,
      subscriberCount: 341_000n,
      totalVideoCount: 158,
      category: "Automotive",
      notes: FICTIONAL_NOTE,
      lastScannedAt: new Date(),
    },
  });

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  // --- Videos + detections -------------------------------------------------

  // V1: high-confidence confirmed sponsor, FIRST_SPONSOR_ONLY, completed job.
  const v1 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000001",
      channelId: modernDevWeekly.id,
      title: "5 VS Code Extensions You Need in 2026",
      description:
        "In this video I run through my favourite VS Code extensions for this year.\n\nThanks to Pixelforge Cloud for sponsoring today's video! Try it free at https://pixelforgecloud.dev/try — use code DEVWEEKLY for 20% off your first month.\n\n0:00 Intro\n0:45 Sponsor\n2:00 Extensions",
      thumbnailUrl: null,
      publishedAt: daysAgo(6),
      durationSeconds: 720,
      viewCount: 48_210n,
      likeCount: 2_140n,
      tags: ["vscode", "sponsor", "developer tools"],
      paidProductPlacement: true,
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      transcriptText: "Hey everyone, welcome back. Thanks to Pixelforge Cloud for sponsoring today's video. Pixelforge Cloud is a build platform, try it free at pixelforgecloud.dev.",
      analysisStatus: "SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 120,
      chunksProcessed: 2,
      stopReason: "first_sponsor_confirmed",
      analysedAt: daysAgo(5),
    },
  });

  const v1Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v1.id,
      brandId: pixelforge.id,
      rawBrandName: "Pixelforge Cloud",
      placementType: "SPONSORED_INTEGRATION",
      startTimestampSeconds: 45,
      endTimestampSeconds: 105,
      evidenceText: "Thanks to Pixelforge Cloud for sponsoring today's video.",
      evidenceSource: "VIDEO_AUDIO",
      confidenceScore: 0.97,
      reasoningSummary:
        "Explicit spoken sponsorship statement, matching on-screen branding, and a matching description link with a discount code all identify Pixelforge Cloud as the sponsor.",
      promotionalUrl: "https://pixelforgecloud.dev/try",
      discountCode: "DEVWEEKLY",
      callToAction: "Try Pixelforge Cloud free using the link below.",
      sponsorshipConfirmed: true,
      reviewStatus: "CONFIRMED",
      reviewedAt: daysAgo(4),
    },
  });

  await prisma.sponsorEvidence.createMany({
    data: [
      {
        sponsorshipDetectionId: v1Detection.id,
        source: "VIDEO_AUDIO",
        timestampSeconds: 45,
        text: "Thanks to Pixelforge Cloud for sponsoring today's video.",
        strength: 0.95,
      },
      {
        sponsorshipDetectionId: v1Detection.id,
        source: "VIDEO_VISUAL",
        timestampSeconds: 50,
        text: "Pixelforge Cloud logo and dashboard shown on screen.",
        strength: 0.8,
      },
      {
        sponsorshipDetectionId: v1Detection.id,
        source: "DESCRIPTION",
        timestampSeconds: null,
        text: "Try it free at https://pixelforgecloud.dev/try — use code DEVWEEKLY for 20% off.",
        strength: 0.9,
      },
    ],
  });

  await prisma.analysisJob.create({
    data: {
      channelId: modernDevWeekly.id,
      videoId: v1.id,
      jobType: "VIDEO_ANALYSIS",
      status: "COMPLETED",
      analysisMode: "FIRST_SPONSOR_ONLY",
      currentChunkStart: 60,
      currentChunkEnd: 120,
      progress: 1,
      secondsAnalysed: 120,
      chunksProcessed: 2,
      estimatedCost: 0.005,
      modelUsage: { chunks: 2, provider: "mock" },
      attempts: 1,
      startedAt: daysAgo(5),
      completedAt: daysAgo(5),
    },
  });

  // V2: organic mention, already reviewed as organic — no automatic sponsor confirmed.
  const v2 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000002",
      channelId: modernDevWeekly.id,
      title: "I Tried Every AI Coding Assistant",
      description: "Testing out a bunch of AI coding tools this week, including one I use personally day to day.",
      publishedAt: daysAgo(20),
      durationSeconds: 900,
      viewCount: 61_500n,
      likeCount: 3_020n,
      tags: ["ai", "coding"],
      paidProductPlacement: false,
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "NO_SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 900,
      chunksProcessed: 15,
      stopReason: "no_sponsor_detected",
      analysedAt: daysAgo(19),
    },
  });

  const v2Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v2.id,
      rawBrandName: "Northwind DevOps",
      placementType: "ORGANIC_MENTION",
      startTimestampSeconds: 240,
      endTimestampSeconds: null,
      evidenceText: "The creator mentions using Northwind DevOps personally, with no disclosure or promotional link.",
      evidenceSource: "TRANSCRIPT",
      confidenceScore: 0.18,
      reasoningSummary: "No explicit disclosure, discount code, or promotional call to action — an organic personal recommendation.",
      sponsorshipConfirmed: false,
      reviewStatus: "ORGANIC",
      reviewedAt: daysAgo(18),
    },
  });
  await prisma.sponsorEvidence.create({
    data: {
      sponsorshipDetectionId: v2Detection.id,
      source: "TRANSCRIPT",
      timestampSeconds: 240,
      text: "Honestly this is just the one I've used for years, nobody's paying me to say this.",
      strength: 0.2,
    },
  });

  // V3: affiliate candidate, pending human review, medium confidence.
  const v3 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000003",
      channelId: modernDevWeekly.id,
      title: "My Morning Routine as a Software Engineer",
      description: "My full morning routine! Some links below are affiliate links which support the channel at no extra cost to you. https://lumenhabits.co/ref/moderndevweekly",
      publishedAt: daysAgo(12),
      durationSeconds: 540,
      viewCount: 29_800n,
      likeCount: 1_450n,
      tags: ["routine", "lifestyle"],
      paidProductPlacement: false,
      transcriptStatus: "MANUAL_UPLOAD_REQUIRED",
      analysisStatus: "PARTIAL",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 540,
      chunksProcessed: 9,
      stopReason: "reached_end_with_unconfirmed_candidate",
      analysedAt: daysAgo(11),
    },
  });
  const v3Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v3.id,
      brandId: lumenHabits.id,
      rawBrandName: "Lumen Habits",
      placementType: "AFFILIATE_PROMOTION",
      startTimestampSeconds: 300,
      endTimestampSeconds: 330,
      evidenceText: "The creator recommends Lumen Habits and mentions a link in the description, with an affiliate disclosure but no explicit sponsorship statement.",
      evidenceSource: "DESCRIPTION",
      confidenceScore: 0.68,
      reasoningSummary: "Affiliate disclosure and a tracked referral link are present, but there is no explicit spoken sponsorship statement, so this remains a pending affiliate candidate rather than a confirmed sponsorship.",
      promotionalUrl: "https://lumenhabits.co/ref/moderndevweekly",
      discountCode: null,
      callToAction: "Links below are affiliate links.",
      sponsorshipConfirmed: false,
      reviewStatus: "PENDING",
    },
  });
  await prisma.sponsorEvidence.createMany({
    data: [
      {
        sponsorshipDetectionId: v3Detection.id,
        source: "DESCRIPTION",
        timestampSeconds: null,
        text: "Some links below are affiliate links which support the channel.",
        strength: 0.7,
      },
      {
        sponsorshipDetectionId: v3Detection.id,
        source: "TRANSCRIPT",
        timestampSeconds: 300,
        text: "I've been using Lumen Habits for a few months now and really like it.",
        strength: 0.5,
      },
    ],
  });

  // V4: ALL_SPONSORS mode, same brand as V1 sponsoring again, reached end of video.
  const v4 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000004",
      channelId: modernDevWeekly.id,
      title: "Building a SaaS in 24 Hours",
      description: "Full build stream recap! Brought to you by Pixelforge Cloud — deploy your app in minutes at https://pixelforgecloud.dev.",
      publishedAt: daysAgo(2),
      durationSeconds: 1800,
      viewCount: 15_300n,
      likeCount: 980n,
      tags: ["saas", "sponsor"],
      paidProductPlacement: true,
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "SPONSOR_FOUND",
      analysisMode: "ALL_SPONSORS",
      secondsAnalysed: 1800,
      chunksProcessed: 30,
      stopReason: "reached_end_of_video",
      analysedAt: daysAgo(1),
    },
  });
  const v4Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v4.id,
      brandId: pixelforge.id,
      rawBrandName: "Pixelforge Cloud",
      placementType: "DEDICATED_VIDEO",
      startTimestampSeconds: 30,
      endTimestampSeconds: 180,
      evidenceText: "Brought to you by Pixelforge Cloud — deploy your app in minutes.",
      evidenceSource: "VIDEO_AUDIO",
      confidenceScore: 0.96,
      reasoningSummary: "Explicit spoken sponsorship statement matching the description link identifies Pixelforge Cloud as the sponsor for this dedicated segment.",
      promotionalUrl: "https://pixelforgecloud.dev",
      sponsorshipConfirmed: true,
      reviewStatus: "CONFIRMED",
      reviewedAt: daysAgo(1),
    },
  });
  await prisma.sponsorEvidence.create({
    data: {
      sponsorshipDetectionId: v4Detection.id,
      source: "VIDEO_AUDIO",
      timestampSeconds: 30,
      text: "Brought to you by Pixelforge Cloud — deploy your app in minutes.",
      strength: 0.95,
    },
  });
  await prisma.analysisJob.create({
    data: {
      channelId: modernDevWeekly.id,
      videoId: v4.id,
      jobType: "VIDEO_ANALYSIS",
      status: "COMPLETED",
      analysisMode: "ALL_SPONSORS",
      progress: 1,
      secondsAnalysed: 1800,
      chunksProcessed: 30,
      estimatedCost: 0.06,
      modelUsage: { chunks: 30, provider: "mock" },
      attempts: 1,
      startedAt: daysAgo(1),
      completedAt: daysAgo(1),
    },
  });

  // V5: no sponsor at all, clean pass, zero detections.
  await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000005",
      channelId: modernDevWeekly.id,
      title: "Why I Switched Back to Vim",
      description: "Just my honest thoughts on editors this year, no sponsor in this one.",
      publishedAt: daysAgo(30),
      durationSeconds: 480,
      viewCount: 22_100n,
      likeCount: 1_760n,
      tags: ["vim", "editors"],
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "NO_SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 480,
      chunksProcessed: 8,
      stopReason: "no_sponsor_detected",
      analysedAt: daysAgo(29),
    },
  });

  // V6: no sponsor, Kitchen With Kayla.
  await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000006",
      channelId: kitchenWithKayla.id,
      title: "Weeknight Pasta in 20 Minutes",
      description: "A quick and easy weeknight pasta recipe the whole family will love.",
      publishedAt: daysAgo(9),
      durationSeconds: 360,
      viewCount: 38_900n,
      likeCount: 2_610n,
      tags: ["recipe", "pasta"],
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "NO_SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 360,
      chunksProcessed: 12,
      stopReason: "no_sponsor_detected",
      analysedAt: daysAgo(8),
    },
  });

  // V7: confirmed dedicated sponsor for Brewtide Coffee Co.
  const v7 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000007",
      channelId: kitchenWithKayla.id,
      title: "The Best Coffee Pairings for Brunch",
      description: "This video is sponsored by Brewtide Coffee Co. Get 15% off with code KAYLA15 at https://brewtidecoffee.com.",
      publishedAt: daysAgo(15),
      durationSeconds: 600,
      viewCount: 54_200n,
      likeCount: 3_890n,
      tags: ["coffee", "brunch", "sponsor"],
      paidProductPlacement: true,
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 90,
      chunksProcessed: 3,
      stopReason: "first_sponsor_confirmed",
      analysedAt: daysAgo(14),
    },
  });
  const v7Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v7.id,
      brandId: brewtide.id,
      rawBrandName: "Brewtide Coffee Co.",
      placementType: "DEDICATED_VIDEO",
      startTimestampSeconds: 15,
      endTimestampSeconds: 90,
      evidenceText: "This video is sponsored by Brewtide Coffee Co.",
      evidenceSource: "VIDEO_AUDIO",
      confidenceScore: 0.95,
      reasoningSummary: "Explicit spoken sponsorship disclosure matching a description link and discount code confirms Brewtide Coffee Co. as the sponsor.",
      promotionalUrl: "https://brewtidecoffee.com",
      discountCode: "KAYLA15",
      callToAction: "Get 15% off with code KAYLA15.",
      sponsorshipConfirmed: true,
      reviewStatus: "CONFIRMED",
      reviewedAt: daysAgo(13),
    },
  });
  await prisma.sponsorEvidence.create({
    data: {
      sponsorshipDetectionId: v7Detection.id,
      source: "VIDEO_AUDIO",
      timestampSeconds: 15,
      text: "This video is sponsored by Brewtide Coffee Co.",
      strength: 0.95,
    },
  });

  // V8: rejected false-positive detection.
  const v8 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000008",
      channelId: kitchenWithKayla.id,
      title: "Kitchen Tools I Actually Use",
      description: "My go-to kitchen tools, no sponsor this time — just personal favourites.",
      publishedAt: daysAgo(25),
      durationSeconds: 420,
      viewCount: 19_400n,
      likeCount: 1_120n,
      tags: ["kitchen", "tools"],
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "PARTIAL",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 420,
      chunksProcessed: 7,
      stopReason: "reached_end_with_unconfirmed_candidate",
      analysedAt: daysAgo(24),
    },
  });
  await prisma.sponsorshipDetection.create({
    data: {
      videoId: v8.id,
      brandId: torqueline.id,
      rawBrandName: "Torqueline Tools",
      placementType: "UNKNOWN",
      startTimestampSeconds: 180,
      endTimestampSeconds: null,
      evidenceText: "A wrench branded similarly to Torqueline Tools appears briefly in the background; likely a false match.",
      evidenceSource: "VIDEO_VISUAL",
      confidenceScore: 0.31,
      reasoningSummary: "Low-confidence, ambiguous visual match with no spoken or description corroboration — rejected on human review as unrelated.",
      sponsorshipConfirmed: false,
      reviewStatus: "REJECTED",
      reviewedAt: daysAgo(23),
    },
  });

  // V9: confirmed sponsor for Torqueline Tools.
  const v9 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000009",
      channelId: gearheadGarage.id,
      title: "Rebuilding a Classic Engine Ep. 12",
      description: "Torqueline Tools is sponsoring this episode! Check out their torque wrench sets at https://torquelinetools.com/pro.",
      publishedAt: daysAgo(4),
      durationSeconds: 1200,
      viewCount: 88_700n,
      likeCount: 6_430n,
      tags: ["engine", "restoration", "sponsor"],
      paidProductPlacement: true,
      transcriptStatus: "AVAILABLE",
      transcriptSource: "mock",
      analysisStatus: "SPONSOR_FOUND",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 60,
      chunksProcessed: 1,
      stopReason: "first_sponsor_confirmed",
      analysedAt: daysAgo(3),
    },
  });
  const v9Detection = await prisma.sponsorshipDetection.create({
    data: {
      videoId: v9.id,
      brandId: torqueline.id,
      rawBrandName: "Torqueline Tools",
      placementType: "SPONSORED_INTEGRATION",
      startTimestampSeconds: 20,
      endTimestampSeconds: 55,
      evidenceText: "Torqueline Tools is sponsoring this episode!",
      evidenceSource: "VIDEO_AUDIO",
      confidenceScore: 0.93,
      reasoningSummary: "Explicit spoken sponsorship statement with a matching description link and on-screen product demonstration confirms Torqueline Tools as the sponsor.",
      promotionalUrl: "https://torquelinetools.com/pro",
      sponsorshipConfirmed: true,
      reviewStatus: "CONFIRMED",
      reviewedAt: daysAgo(2),
    },
  });
  await prisma.sponsorEvidence.create({
    data: {
      sponsorshipDetectionId: v9Detection.id,
      source: "VIDEO_AUDIO",
      timestampSeconds: 20,
      text: "Torqueline Tools is sponsoring this episode!",
      strength: 0.9,
    },
  });

  // V10: failed analysis job.
  const v10 = await prisma.video.create({
    data: {
      youtubeVideoId: "FICT0000010",
      channelId: gearheadGarage.id,
      title: "Garage Tour 2026",
      description: "Come take a look around the shop!",
      publishedAt: daysAgo(1),
      durationSeconds: 300,
      viewCount: 5_200n,
      likeCount: 410n,
      tags: ["garage", "tour"],
      transcriptStatus: "UNAVAILABLE",
      analysisStatus: "FAILED",
      analysisMode: "FIRST_SPONSOR_ONLY",
      secondsAnalysed: 60,
      chunksProcessed: 1,
      stopReason: "provider_error: Gemini chunk analysis failed after 3 attempts: simulated network timeout",
      analysedAt: daysAgo(1),
    },
  });
  await prisma.analysisJob.create({
    data: {
      channelId: gearheadGarage.id,
      videoId: v10.id,
      jobType: "VIDEO_ANALYSIS",
      status: "FAILED",
      analysisMode: "FIRST_SPONSOR_ONLY",
      progress: 0.2,
      secondsAnalysed: 60,
      chunksProcessed: 1,
      estimatedCost: 0.001,
      modelUsage: { chunks: 1, provider: "mock" },
      errorMessage: "Gemini chunk analysis failed after 3 attempts: simulated network timeout",
      attempts: 3,
      startedAt: daysAgo(1),
      completedAt: daysAgo(1),
    },
  });

  // --- Rule-based creator opportunities (real service, not hand-authored) ---
  for (const brand of [pixelforge, brewtide, torqueline, lumenHabits]) {
    await refreshCreatorOpportunitiesForBrand(brand.id);
  }

  console.log("Seed complete:");
  console.log("  Channels: 3, Videos: 10, Brands: 4");
  console.log("  All data is fictional and clearly labelled as such.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
