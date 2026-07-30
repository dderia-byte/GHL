-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('DEDICATED_VIDEO', 'SPONSORED_INTEGRATION', 'PRODUCT_PLACEMENT', 'AFFILIATE_PROMOTION', 'FREE_PRODUCT_OR_GIFTED', 'ORGANIC_MENTION', 'CHANNEL_PARTNERSHIP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EDITED', 'ORGANIC');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'AVAILABLE', 'UNAVAILABLE', 'FAILED', 'MANUAL_UPLOAD_REQUIRED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'PROCESSING', 'SPONSOR_FOUND', 'NO_SPONSOR_FOUND', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AnalysisMode" AS ENUM ('FIRST_SPONSOR_ONLY', 'ALL_SPONSORS');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('VIDEO_AUDIO', 'VIDEO_VISUAL', 'TRANSCRIPT', 'DESCRIPTION', 'YOUTUBE_METADATA', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CHANNEL_SCAN', 'VIDEO_ANALYSIS');

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "youtubeChannelId" TEXT NOT NULL,
    "handle" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "subscriberCount" BIGINT,
    "totalVideoCount" INTEGER,
    "category" TEXT,
    "notes" TEXT,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "viewCount" BIGINT,
    "likeCount" BIGINT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paidProductPlacement" BOOLEAN NOT NULL DEFAULT false,
    "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "transcriptSource" TEXT,
    "transcriptText" TEXT,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "analysisMode" "AnalysisMode" NOT NULL DEFAULT 'FIRST_SPONSOR_ONLY',
    "secondsAnalysed" INTEGER NOT NULL DEFAULT 0,
    "chunksProcessed" INTEGER NOT NULL DEFAULT 0,
    "stopReason" TEXT,
    "analysedAt" TIMESTAMP(3),
    "mediaAuthorised" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION,
    "durationSeconds" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "domain" TEXT,
    "category" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorshipDetection" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "brandId" TEXT,
    "rawBrandName" TEXT NOT NULL,
    "placementType" "PlacementType" NOT NULL DEFAULT 'UNKNOWN',
    "startTimestampSeconds" INTEGER,
    "endTimestampSeconds" INTEGER,
    "evidenceText" TEXT NOT NULL,
    "evidenceSource" "EvidenceSource" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "reasoningSummary" TEXT NOT NULL,
    "promotionalUrl" TEXT,
    "discountCode" TEXT,
    "callToAction" TEXT,
    "sponsorshipConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorshipDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorEvidence" (
    "id" TEXT NOT NULL,
    "sponsorshipDetectionId" TEXT NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "timestampSeconds" INTEGER,
    "text" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "videoId" TEXT,
    "jobType" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "analysisMode" "AnalysisMode" NOT NULL DEFAULT 'FIRST_SPONSOR_ONLY',
    "currentChunkStart" INTEGER,
    "currentChunkEnd" INTEGER,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "secondsAnalysed" INTEGER NOT NULL DEFAULT 0,
    "chunksProcessed" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelUsage" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitorSuggestion" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "suggestedBrandName" TEXT NOT NULL,
    "suggestedDomain" TEXT,
    "reason" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCompetitorSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorOpportunity" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "conflictWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_youtubeChannelId_key" ON "Channel"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "Channel_handle_idx" ON "Channel"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Video_youtubeVideoId_key" ON "Video"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "Video_channelId_idx" ON "Video"("channelId");

-- CreateIndex
CREATE INDEX "Video_analysisStatus_idx" ON "Video"("analysisStatus");

-- CreateIndex
CREATE INDEX "TranscriptSegment_videoId_idx" ON "TranscriptSegment"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_canonicalName_key" ON "Brand"("canonicalName");

-- CreateIndex
CREATE INDEX "Brand_domain_idx" ON "Brand"("domain");

-- CreateIndex
CREATE INDEX "SponsorshipDetection_videoId_idx" ON "SponsorshipDetection"("videoId");

-- CreateIndex
CREATE INDEX "SponsorshipDetection_brandId_idx" ON "SponsorshipDetection"("brandId");

-- CreateIndex
CREATE INDEX "SponsorshipDetection_reviewStatus_idx" ON "SponsorshipDetection"("reviewStatus");

-- CreateIndex
CREATE INDEX "SponsorEvidence_sponsorshipDetectionId_idx" ON "SponsorEvidence"("sponsorshipDetectionId");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_idx" ON "AnalysisJob"("status");

-- CreateIndex
CREATE INDEX "AnalysisJob_channelId_idx" ON "AnalysisJob"("channelId");

-- CreateIndex
CREATE INDEX "AnalysisJob_videoId_idx" ON "AnalysisJob"("videoId");

-- CreateIndex
CREATE INDEX "BrandCompetitorSuggestion_brandId_idx" ON "BrandCompetitorSuggestion"("brandId");

-- CreateIndex
CREATE INDEX "CreatorOpportunity_brandId_idx" ON "CreatorOpportunity"("brandId");

-- CreateIndex
CREATE INDEX "CreatorOpportunity_channelId_idx" ON "CreatorOpportunity"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorOpportunity_brandId_channelId_key" ON "CreatorOpportunity"("brandId", "channelId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipDetection" ADD CONSTRAINT "SponsorshipDetection_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorshipDetection" ADD CONSTRAINT "SponsorshipDetection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorEvidence" ADD CONSTRAINT "SponsorEvidence_sponsorshipDetectionId_fkey" FOREIGN KEY ("sponsorshipDetectionId") REFERENCES "SponsorshipDetection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCompetitorSuggestion" ADD CONSTRAINT "BrandCompetitorSuggestion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOpportunity" ADD CONSTRAINT "CreatorOpportunity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOpportunity" ADD CONSTRAINT "CreatorOpportunity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
