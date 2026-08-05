/** Standalone script (run via `tsx`) that clears the E2E test database between runs. */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  await prisma.$transaction([
    prisma.creatorOpportunity.deleteMany(),
    prisma.brandCompetitorSuggestion.deleteMany(),
    prisma.sponsorEvidence.deleteMany(),
    prisma.sponsorshipDetection.deleteMany(),
    prisma.analysisJob.deleteMany(),
    prisma.transcriptSegment.deleteMany(),
    prisma.video.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.channel.deleteMany(),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
