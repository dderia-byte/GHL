-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "confirmedSponsorBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "latestEligibleVideoAt" TIMESTAMP(3),
ADD COLUMN     "qualifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DiscoveryCandidate" ADD COLUMN     "uniqueSponsors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "candidatesAnalysed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qualifiedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectedNoSponsor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "searchCursors" JSONB,
ADD COLUMN     "stopReason" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "isLivestream" BOOLEAN NOT NULL DEFAULT false;
