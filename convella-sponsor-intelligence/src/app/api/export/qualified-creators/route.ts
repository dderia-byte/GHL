import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildQualifiedCreatorsCsv, qualifiedCreatorsFilename } from "@/lib/csv/qualified-creators-export";

/**
 * Exports the qualified creators of ONE RUN — by default the most recent run, or
 * `?runId=` for a specific one.
 *
 * This is deliberately per-run rather than cumulative. A creator who qualified last
 * month is not excluded from this month's file: they were re-analysed and, if a recent
 * sponsor was found, they belong in the new list too. Within a single file each
 * creator appears exactly once, keyed on YouTube channel id.
 *
 * Sponsor brands come from the CANDIDATE (what this run found in the newest four
 * eligible videos), not from the channel's accumulated history, so the file reflects
 * current sponsorships rather than everything ever detected.
 */
export async function GET(request: Request) {
  const requestedRunId = new URL(request.url).searchParams.get("runId");

  const run = requestedRunId
    ? await prisma.discoveryRun.findUnique({ where: { id: requestedRunId }, select: { id: true } })
    : await prisma.discoveryRun.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });

  const candidates = run
    ? await prisma.discoveryCandidate.findMany({
        where: { discoveryRunId: run.id, state: "COMPLETED", channelId: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: {
          uniqueSponsors: true,
          channel: {
            select: {
              name: true,
              youtubeChannelId: true,
              handle: true,
              latestEligibleVideoAt: true,
              niche: true,
              profile: { select: { primaryNiche: true } },
            },
          },
        },
      })
    : [];

  const csv = buildQualifiedCreatorsCsv(
    candidates
      .filter((candidate) => candidate.channel !== null && candidate.uniqueSponsors.length > 0)
      .map((candidate) => ({
        channelName: candidate.channel!.name,
        youtubeChannelId: candidate.channel!.youtubeChannelId,
        handle: candidate.channel!.handle,
        niche: candidate.channel!.profile?.primaryNiche ?? candidate.channel!.niche,
        sponsorBrands: candidate.uniqueSponsors,
        latestEligibleVideoAt: candidate.channel!.latestEligibleVideoAt,
      })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${qualifiedCreatorsFilename()}"`,
    },
  });
}
