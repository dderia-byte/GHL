-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "aiFallbackVideos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creatorsWithNoSponsor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metadataOnlyVideos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transcriptFallbackVideos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unclearVideos" INTEGER NOT NULL DEFAULT 0;
