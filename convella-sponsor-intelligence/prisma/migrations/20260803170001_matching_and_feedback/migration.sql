-- CreateEnum
CREATE TYPE "MatchRecommendation" AS ENUM ('STRONG_MATCH', 'GOOD_MATCH', 'NEEDS_MORE_RESEARCH', 'WEAK_MATCH', 'REJECT');

-- CreateEnum
CREATE TYPE "CreatorDecision" AS ENUM ('APPROVE', 'REJECT', 'NEEDS_MORE_RESEARCH', 'CONTACT_LATER', 'NOT_RELEVANT', 'TOO_EXPENSIVE', 'WEAK_VIEWS', 'WRONG_AUDIENCE', 'ALREADY_CONTACTED', 'DUPLICATE', 'GOOD_FIT');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'REPLIED', 'IN_DISCUSSION', 'NEGOTIATING', 'WON', 'LOST', 'DECLINED');

-- CreateTable
CREATE TABLE "CreatorBrandMatch" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "recommendation" "MatchRecommendation" NOT NULL,
    "components" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "weightsUsed" JSONB NOT NULL,
    "manualScore" INTEGER,
    "manualNote" TEXT,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorBrandMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFeedback" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "brandId" TEXT,
    "matchId" TEXT,
    "decision" "CreatorDecision" NOT NULL,
    "reason" TEXT,
    "humanScore" INTEGER,
    "matchScoreAtDecision" INTEGER,
    "confidenceScoreAtDecision" INTEGER,
    "signalsAtDecision" JSONB,
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorOutreach" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "contactedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "quotedRateUsd" DECIMAL(10,2),
    "agreedRateUsd" DECIMAL(10,2),
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorBrandMatch_brandId_matchScore_idx" ON "CreatorBrandMatch"("brandId", "matchScore");

-- CreateIndex
CREATE INDEX "CreatorBrandMatch_recommendation_idx" ON "CreatorBrandMatch"("recommendation");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorBrandMatch_channelId_brandId_key" ON "CreatorBrandMatch"("channelId", "brandId");

-- CreateIndex
CREATE INDEX "CreatorFeedback_channelId_idx" ON "CreatorFeedback"("channelId");

-- CreateIndex
CREATE INDEX "CreatorFeedback_brandId_idx" ON "CreatorFeedback"("brandId");

-- CreateIndex
CREATE INDEX "CreatorFeedback_decision_createdAt_idx" ON "CreatorFeedback"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorOutreach_status_idx" ON "CreatorOutreach"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorOutreach_channelId_brandId_key" ON "CreatorOutreach"("channelId", "brandId");

-- AddForeignKey
ALTER TABLE "CreatorBrandMatch" ADD CONSTRAINT "CreatorBrandMatch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorBrandMatch" ADD CONSTRAINT "CreatorBrandMatch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFeedback" ADD CONSTRAINT "CreatorFeedback_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFeedback" ADD CONSTRAINT "CreatorFeedback_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFeedback" ADD CONSTRAINT "CreatorFeedback_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CreatorBrandMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOutreach" ADD CONSTRAINT "CreatorOutreach_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorOutreach" ADD CONSTRAINT "CreatorOutreach_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
