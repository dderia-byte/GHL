import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildQualifiedCreatorsCsv, qualifiedCreatorsFilename } from "@/lib/csv/qualified-creators-export";

/**
 * Exports qualified creators (>=1 confirmed external paid sponsor). Pass ?runId= to
 * export only the creators a specific run qualified; otherwise every qualified
 * creator in the database is exported. Each creator appears exactly once.
 */
export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");

  const channels = await prisma.channel.findMany({
    where: {
      qualifiedAt: { not: null },
      ...(runId ? { discoveryCandidates: { some: { discoveryRunId: runId, state: "COMPLETED" } } } : {}),
    },
    orderBy: { qualifiedAt: "desc" },
    select: {
      name: true,
      youtubeChannelId: true,
      niche: true,
      confirmedSponsorBrands: true,
      latestEligibleVideoAt: true,
      // Any candidate flagged previouslySeen means this creator was already known
      // before the run that surfaced them.
      discoveryCandidates: { select: { previouslySeen: true } },
    },
  });

  const csv = buildQualifiedCreatorsCsv(
    channels.map((c) => ({
      channelName: c.name,
      youtubeChannelId: c.youtubeChannelId,
      niche: c.niche,
      sponsorBrands: c.confirmedSponsorBrands,
      latestEligibleVideoAt: c.latestEligibleVideoAt,
      previouslySeen: c.discoveryCandidates.some((candidate) => candidate.previouslySeen),
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${qualifiedCreatorsFilename()}"`,
    },
  });
}
