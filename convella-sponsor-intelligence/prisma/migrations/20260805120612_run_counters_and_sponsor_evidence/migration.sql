-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "sponsorEvidence" JSONB;

-- AlterTable
ALTER TABLE "DiscoveryCandidate" ADD COLUMN     "sponsorEvidence" JSONB;

-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "cooldownSkipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previouslyQualifiedSkipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sameRunDuplicatesMerged" INTEGER NOT NULL DEFAULT 0;
