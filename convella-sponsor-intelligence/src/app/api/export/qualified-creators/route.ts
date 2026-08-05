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
      handle: true,
      confirmedSponsorBrands: true,
      latestEligibleVideoAt: true,
      // Niche comes from the creator's own content (CreatorProfile), not from the
      // search text that happened to surface them.
      profile: { select: { primaryNiche: true } },
      niche: true,
    },
  });

  const csv = buildQualifiedCreatorsCsv(
    channels.map((c) => ({
      channelName: c.name,
      youtubeChannelId: c.youtubeChannelId,
      handle: c.handle,
      niche: c.profile?.primaryNiche ?? c.niche,
      sponsorBrands: c.confirmedSponsorBrands,
      latestEligibleVideoAt: c.latestEligibleVideoAt,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${qualifiedCreatorsFilename()}"`,
    },
  });
}
