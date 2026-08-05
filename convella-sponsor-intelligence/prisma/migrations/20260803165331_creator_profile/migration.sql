-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "longFormVideoCount" INTEGER NOT NULL DEFAULT 0,
    "shortsVideoCount" INTEGER NOT NULL DEFAULT 0,
    "shortsRatio" DOUBLE PRECISION,
    "avgViewsLast10" DOUBLE PRECISION,
    "avgViewsLast25" DOUBLE PRECISION,
    "medianViewsLast25" DOUBLE PRECISION,
    "highestRecentViews" INTEGER,
    "lowestRecentViews" INTEGER,
    "viewsPerSubscriber" DOUBLE PRECISION,
    "avgLikes" DOUBLE PRECISION,
    "avgComments" DOUBLE PRECISION,
    "engagementRate" DOUBLE PRECISION,
    "uploadsPerMonth" DOUBLE PRECISION,
    "daysSinceLastUpload" INTEGER,
    "viewTrendRatio" DOUBLE PRECISION,
    "uploadConsistency" DOUBLE PRECISION,
    "sponsorshipFrequency" DOUBLE PRECISION,
    "sponsoredVideoCount" INTEGER NOT NULL DEFAULT 0,
    "distinctSponsorCount" INTEGER NOT NULL DEFAULT 0,
    "repeatSponsorCount" INTEGER NOT NULL DEFAULT 0,
    "lastSponsorshipAt" TIMESTAMP(3),
    "businessEmail" TEXT,
    "website" TEXT,
    "socialLinks" JSONB,
    "primaryNiche" TEXT,
    "secondaryNiche" TEXT,
    "nicheWeights" JSONB,
    "recurringTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technicalDepth" TEXT,
    "profileCompleteness" DOUBLE PRECISION,
    "videosConsidered" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_channelId_key" ON "CreatorProfile"("channelId");

-- CreateIndex
CREATE INDEX "CreatorProfile_channelId_idx" ON "CreatorProfile"("channelId");

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
