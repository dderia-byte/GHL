-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'HALTED_COST_LIMIT', 'HALTED_QUOTA_LIMIT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CandidateState" AS ENUM ('DISCOVERED', 'FILTERED_OUT', 'PENDING_ANALYSIS', 'ANALYSING_NEWEST', 'CHECKING_SIGNALS', 'ANALYSING_SECOND', 'QUALIFIED', 'DEEP_SCANNING', 'QUALIFIED_PARTIAL', 'COMPLETED', 'REJECTED_NOT_COMMERCIAL', 'REJECTED_NO_SPONSOR', 'CANCELLED', 'ERRORED');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('SUBSCRIBERS_OVER_CAP', 'SUBSCRIBERS_HIDDEN', 'NICHE_MISMATCH', 'INACTIVE', 'NOT_COMMERCIAL', 'NO_SPONSOR', 'DUPLICATE_KNOWN', 'DUPLICATE_REJECTED', 'UNAVAILABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'DISCOVERY_RUN';
ALTER TYPE "JobType" ADD VALUE 'CREATOR_QUALIFICATION';

-- AlterTable
ALTER TABLE "AnalysisJob" ADD COLUMN     "discoveryCandidateId" TEXT,
ADD COLUMN     "discoveryRunId" TEXT;

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "discoveredAt" TIMESTAMP(3),
ADD COLUMN     "discoverySource" TEXT,
ADD COLUMN     "monitoringStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "niche" TEXT;

-- CreateTable
CREATE TABLE "DiscoveryQuery" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "searchType" TEXT NOT NULL DEFAULT 'video',
    "regionCode" TEXT,
    "relevanceLanguage" TEXT,
    "publishedWithinDays" INTEGER,
    "nicheKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nicheTopicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPages" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastExecutedAt" TIMESTAMP(3),
    "lastResultCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "settingsSnapshot" JSONB NOT NULL,
    "channelsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "candidatesCreated" INTEGER NOT NULL DEFAULT 0,
    "candidatesRejected" INTEGER NOT NULL DEFAULT 0,
    "creatorsQualified" INTEGER NOT NULL DEFAULT 0,
    "videosAnalysed" INTEGER NOT NULL DEFAULT 0,
    "quotaUnitsUsed" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryCandidate" (
    "id" TEXT NOT NULL,
    "discoveryRunId" TEXT NOT NULL,
    "discoveryQueryId" TEXT,
    "youtubeChannelId" TEXT NOT NULL,
    "channelTitle" TEXT,
    "channelId" TEXT,
    "state" "CandidateState" NOT NULL DEFAULT 'DISCOVERED',
    "rejectionReason" "RejectionReason",
    "rejectionExpiresAt" TIMESTAMP(3),
    "borderline" BOOLEAN NOT NULL DEFAULT false,
    "nicheDecision" JSONB,
    "promotionalSignals" JSONB,
    "subscriberCountAtDiscovery" BIGINT,
    "deepScanVideoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deepScanCursor" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "QuotaLedger" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "jobId" TEXT,
    "reservationKey" TEXT NOT NULL,
    "unitsReserved" INTEGER NOT NULL,
    "unitsCommitted" INTEGER NOT NULL DEFAULT 0,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryQuery_enabled_priority_idx" ON "DiscoveryQuery"("enabled", "priority");

-- CreateIndex
CREATE INDEX "DiscoveryRun_status_idx" ON "DiscoveryRun"("status");

-- CreateIndex
CREATE INDEX "DiscoveryRun_createdAt_idx" ON "DiscoveryRun"("createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_state_idx" ON "DiscoveryCandidate"("state");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_youtubeChannelId_state_idx" ON "DiscoveryCandidate"("youtubeChannelId", "state");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_discoveryQueryId_idx" ON "DiscoveryCandidate"("discoveryQueryId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCandidate_discoveryRunId_youtubeChannelId_key" ON "DiscoveryCandidate"("discoveryRunId", "youtubeChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaLedger_reservationKey_key" ON "QuotaLedger"("reservationKey");

-- CreateIndex
CREATE INDEX "QuotaLedger_date_idx" ON "QuotaLedger"("date");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_discoveryRunId_idx" ON "AnalysisJob"("discoveryRunId");

-- CreateIndex
CREATE INDEX "AnalysisJob_discoveryCandidateId_idx" ON "AnalysisJob"("discoveryCandidateId");

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_discoveryCandidateId_fkey" FOREIGN KEY ("discoveryCandidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_discoveryQueryId_fkey" FOREIGN KEY ("discoveryQueryId") REFERENCES "DiscoveryQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
