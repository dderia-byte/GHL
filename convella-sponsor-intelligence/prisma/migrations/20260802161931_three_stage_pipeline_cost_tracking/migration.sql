-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "descriptionHash" TEXT,
ADD COLUMN     "pipelineVersion" INTEGER,
ADD COLUMN     "resolvedAtStage" INTEGER,
ADD COLUMN     "transcriptHash" TEXT;

-- CreateTable
CREATE TABLE "AnalysisUsage" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "analysisJobId" TEXT,
    "resolvedAtStage" INTEGER,
    "textModelCalls" INTEGER NOT NULL DEFAULT 0,
    "reasoningModelCalls" INTEGER NOT NULL DEFAULT 0,
    "videoModelCalls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "transcriptCharactersSent" INTEGER NOT NULL DEFAULT 0,
    "nativeVideoSecondsAnalysed" INTEGER NOT NULL DEFAULT 0,
    "estimatedTextCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "estimatedReasoningCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "estimatedVideoCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "totalEstimatedCost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "costLimitReached" BOOLEAN NOT NULL DEFAULT false,
    "skippedExpensiveReason" TEXT,
    "nativeVideoUsed" BOOLEAN NOT NULL DEFAULT false,
    "nativeAudioUsed" BOOLEAN NOT NULL DEFAULT false,
    "visualAnalysisUsed" BOOLEAN NOT NULL DEFAULT false,
    "promptCacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "promptCacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisUsage_videoId_idx" ON "AnalysisUsage"("videoId");

-- CreateIndex
CREATE INDEX "AnalysisUsage_analysisJobId_idx" ON "AnalysisUsage"("analysisJobId");

-- AddForeignKey
ALTER TABLE "AnalysisUsage" ADD CONSTRAINT "AnalysisUsage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
