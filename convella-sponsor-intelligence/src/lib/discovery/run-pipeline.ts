import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import { getYouTubeSearchProvider } from "@/lib/youtube/search-provider";
import { youtubeClient } from "@/lib/youtube/client";
import type { YouTubeChannelResource } from "@/lib/youtube/types";
import { upsertChannelRecord } from "@/lib/jobs/channel-scan-pipeline";
import { enqueueCreatorQualificationJob } from "@/lib/jobs/queue";
import type { RejectionReason } from "@/generated/prisma/enums";
import { evaluateFilters } from "./filters";
import { classifyDiscovery } from "./duplicate-policy";
import { finalizeRunIfDone, parseSettingsSnapshot } from "./service";
import { QUOTA_COST, QuotaExhaustedError, commitQuota, releaseQuota, reserveQuota } from "./quota";

interface DiscoveredChannel {
  youtubeChannelId: string;
  channelTitle: string;
  discoveryQueryId: string;
}

/**
 * DISCOVERY_RUN job handler: executes the run's search phase — enabled queries via
 * the search provider (quota reserved before every page), three-level dedup, batched
 * hydration, free filters — then creates candidates and enqueues one
 * CREATOR_QUALIFICATION job per accepted candidate. Everything is idempotent:
 * a replay after a crash upserts candidates (unique [runId, youtubeChannelId]) and
 * re-uses quota reservations by key, so no duplicate spend and no duplicate rows.
 */
export async function processDiscoveryRunJob(jobId: string, discoveryRunId: string): Promise<void> {
  const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: discoveryRunId } });
  if (run.cancelRequested || run.status === "CANCELLED") {
    await prisma.analysisJob.update({ where: { id: jobId }, data: { status: "CANCELLED", completedAt: new Date() } });
    return;
  }

  const settings = parseSettingsSnapshot(run.settingsSnapshot);
  await prisma.discoveryRun.update({
    where: { id: discoveryRunId },
    data: { status: "RUNNING", startedAt: run.startedAt ?? new Date() },
  });

  const provider = getYouTubeSearchProvider();
  // Continuation passes resume from the stored page cursors so the run keeps finding
  // NEW creators rather than re-paying for page one of every query.
  const storedCursors = (run.searchCursors as { tokens?: Record<string, string | null> } | null)?.tokens ?? {};
  const nextCursors: Record<string, string | null> = { ...storedCursors };

  const queries = await prisma.discoveryQuery.findMany({
    where: { enabled: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  // --- Search phase (quota-guarded) -------------------------------------------
  const discovered = new Map<string, DiscoveredChannel>(); // intra-run dedup: first query wins provenance
  let quotaUnitsUsed = 0;
  // A search hit for a channel this run has already seen — under another keyword, or
  // on an earlier page. Counted, never rejected.
  let sameRunDuplicatesMerged = 0;

  for (const query of queries) {
    // Re-spend guard: an identical query executed very recently returns near-identical
    // results — skip it rather than pay another 100 units (spec §8.4).
    if (
      query.lastExecutedAt &&
      Date.now() - query.lastExecutedAt.getTime() < settings.minIntervalHours * 3600 * 1000 &&
      run.trigger === "scheduled"
    ) {
      await recordAudit({
        actorType: "worker",
        action: "discovery.query.skipped_recent",
        entityType: "DiscoveryQuery",
        entityId: query.id,
        detail: { discoveryRunId, lastExecutedAt: query.lastExecutedAt.toISOString() },
      });
      continue;
    }

    const pages = Math.min(query.maxPages, settings.maxPagesPerQuery);
    // A query whose cursor is explicitly null has already been paged to the end.
    if (Object.prototype.hasOwnProperty.call(storedCursors, query.id) && storedCursors[query.id] === null) continue;
    let pageToken: string | undefined = storedCursors[query.id] ?? undefined;
    let resultCount = 0;

    for (let page = 0; page < pages; page += 1) {
      const reservationKey = `run:${discoveryRunId}:query:${query.id}:page:${page}`;
      try {
        await reserveQuota({
          reservationKey,
          units: QUOTA_COST.SEARCH_PAGE,
          purpose: "search",
          dailyBudget: settings.dailyQuotaUnits,
          jobId,
        });
      } catch (error) {
        if (error instanceof QuotaExhaustedError) {
          await haltRunForQuota(jobId, discoveryRunId, quotaUnitsUsed, error);
          return;
        }
        throw error;
      }

      try {
        const result = await provider.search(query.queryText, {
          searchType: query.searchType === "channel" ? "channel" : "video",
          regionCode: query.regionCode ?? undefined,
          relevanceLanguage: query.relevanceLanguage ?? undefined,
          publishedAfter: query.publishedWithinDays
            ? new Date(Date.now() - query.publishedWithinDays * 24 * 3600 * 1000)
            : undefined,
          pageToken,
        });
        await commitQuota(reservationKey);
        quotaUnitsUsed += QUOTA_COST.SEARCH_PAGE;

        for (const item of result.results) {
          resultCount += 1;
          if (discovered.has(item.channelId)) {
            sameRunDuplicatesMerged += 1;
            continue;
          }
          discovered.set(item.channelId, {
            youtubeChannelId: item.channelId,
            channelTitle: item.channelTitle,
            discoveryQueryId: query.id,
          });
        }

        nextCursors[query.id] = result.nextPageToken;
        if (!result.nextPageToken) break;
        pageToken = result.nextPageToken;
      } catch (error) {
        await releaseQuota(reservationKey);
        throw error;
      }
    }

    await prisma.discoveryQuery.update({
      where: { id: query.id },
      data: { lastExecutedAt: new Date(), lastResultCount: resultCount },
    });
  }

  // --- Dedup (current run only) --------------------------------------------------
  // Two cases, neither of which is a rejection:
  //
  //  1. Same channel under several keywords in THIS run — merged by channel id in the
  //     `discovered` map above. The keyword that found them first owns the provenance.
  //  2. Already a candidate earlier in THIS run (a continuation pass re-found them) —
  //     merged silently; the candidate row is already queued or analysed.
  //
  // There is deliberately NO permanent exclusion. A creator qualified or rejected by a
  // previous run is analysed again: they may have taken on a sponsor since. SQL is
  // history and cache (unchanged videos reuse their cached analysis for free), not a
  // blocklist.
  const allIds = Array.from(discovered.keys());

  const existingThisRun = allIds.length
    ? await prisma.discoveryCandidate.findMany({
        where: { discoveryRunId, youtubeChannelId: { in: allIds } },
        select: { youtubeChannelId: true },
      })
    : [];
  const existingThisRunSet = new Set(existingThisRun.map((c) => c.youtubeChannelId));

  const toHydrate: DiscoveredChannel[] = [];

  for (const channel of discovered.values()) {
    const disposition = classifyDiscovery({
      youtubeChannelId: channel.youtubeChannelId,
      candidateIdsThisRun: existingThisRunSet,
    });
    if (disposition.action === "MERGE") {
      sameRunDuplicatesMerged += 1;
      continue;
    }
    toHydrate.push(channel);
  }

  // --- Hydration (batched; mock provider supplies fixtures keylessly) -----------
  let hydrated: YouTubeChannelResource[] = [];
  if (toHydrate.length > 0) {
    if (provider.getChannels) {
      hydrated = await provider.getChannels(toHydrate.map((c) => c.youtubeChannelId));
    } else {
      const batches = Math.ceil(toHydrate.length / 50);
      const reservationKey = `run:${discoveryRunId}:hydration:channels`;
      try {
        await reserveQuota({
          reservationKey,
          units: batches * QUOTA_COST.CHANNELS_LIST,
          purpose: "hydration",
          dailyBudget: settings.dailyQuotaUnits,
          jobId,
        });
      } catch (error) {
        if (error instanceof QuotaExhaustedError) {
          await haltRunForQuota(jobId, discoveryRunId, quotaUnitsUsed, error);
          return;
        }
        throw error;
      }
      try {
        hydrated = await youtubeClient.getChannelsByIds(toHydrate.map((c) => c.youtubeChannelId));
        await commitQuota(reservationKey);
        quotaUnitsUsed += batches * QUOTA_COST.CHANNELS_LIST;
      } catch (error) {
        await releaseQuota(reservationKey);
        throw error;
      }
    }
  }
  const hydratedById = new Map(hydrated.map((c) => [c.id, c]));

  // --- Filters + candidate creation ---------------------------------------------
  // The per-pass cap never lets the run exceed its overall candidate ceiling.
  const remainingCandidateBudget = Math.max(0, settings.maxCandidatesPerRun - run.candidatesAnalysed);
  const perPassCap = Math.min(settings.maxCreatorsPerRun, remainingCandidateBudget);

  const queryById = new Map(queries.map((q) => [q.id, q]));
  const cooldownMs = settings.rejectionCooldownDays * 24 * 3600 * 1000;
  let candidatesCreated = 0;
  let candidatesRejected = 0;
  const acceptedCandidateIds: string[] = [];

  for (const channelRef of toHydrate) {
    const resource = hydratedById.get(channelRef.youtubeChannelId);
    if (!resource) {
      await upsertCandidate({
        discoveryRunId,
        channel: channelRef,
        state: "FILTERED_OUT",
        rejectionReason: "UNAVAILABLE",
        rejectionExpiresAt: new Date(Date.now() + cooldownMs),
        detail: "Channel could not be hydrated from the YouTube API (deleted, terminated, or private).",
      });
      candidatesRejected += 1;
      continue;
    }

    const query = queryById.get(channelRef.discoveryQueryId);
    const outcome = evaluateFilters({ channel: resource, settings });

    if (!outcome.passed) {
      await upsertCandidate({
        discoveryRunId,
        channel: channelRef,
        state: "FILTERED_OUT",
        rejectionReason: outcome.rejectionReason,
        rejectionExpiresAt: new Date(Date.now() + cooldownMs),
        detail: outcome.detail,
        subscriberCount: resource.subscriberCount,
      });
      candidatesRejected += 1;
      continue;
    }

    if (candidatesCreated >= perPassCap) {
      // Over the per-run cap: not created at all — they will surface again on the
      // next run if the queries keep finding them.
      continue;
    }

    // Accepted: hydrate a Channel row now (it is about to be monitored) and create
    // the candidate at PENDING_ANALYSIS.
    const channelRow = await upsertChannelRecord(resource);
    await prisma.channel.update({
      where: { id: channelRow.id },
      data: { discoverySource: "discovery", discoveredAt: new Date(), niche: query?.queryText ?? null },
    });

    const candidate = await prisma.discoveryCandidate.upsert({
      where: { discoveryRunId_youtubeChannelId: { discoveryRunId, youtubeChannelId: channelRef.youtubeChannelId } },
      update: {},
      create: {
        discoveryRunId,
        discoveryQueryId: channelRef.discoveryQueryId,
        youtubeChannelId: channelRef.youtubeChannelId,
        channelTitle: resource.title,
        channelId: channelRow.id,
        state: "PENDING_ANALYSIS",
        subscriberCountAtDiscovery: resource.subscriberCount !== null ? BigInt(resource.subscriberCount) : null,
      },
    });
    acceptedCandidateIds.push(candidate.id);
    candidatesCreated += 1;
  }

  for (const candidateId of acceptedCandidateIds) {
    await enqueueCreatorQualificationJob(discoveryRunId, candidateId);
  }

  const searchExhausted = Object.values(nextCursors).every((token) => token === null) && Object.keys(nextCursors).length > 0;

  await prisma.discoveryRun.update({
    where: { id: discoveryRunId },
    data: {
      channelsDiscovered: { increment: discovered.size },
      candidatesCreated: { increment: candidatesCreated },
      candidatesRejected: { increment: candidatesRejected },
      candidatesAnalysed: { increment: candidatesCreated },
      // Both mean the same thing now: repeat appearances collapsed WITHIN this run.
      // previouslyQualifiedSkipped/cooldownSkipped are no longer written — creators
      // from previous runs are never skipped.
      duplicatesSkipped: { increment: sameRunDuplicatesMerged },
      sameRunDuplicatesMerged: { increment: sameRunDuplicatesMerged },
      quotaUnitsUsed: { increment: quotaUnitsUsed },
      searchCursors: JSON.parse(JSON.stringify({ tokens: nextCursors, exhausted: searchExhausted })),
    },
  });
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: new Date(), progress: 1 },
  });
  await recordAudit({
    actorType: "worker",
    action: "discovery.run.search_completed",
    entityType: "DiscoveryRun",
    entityId: discoveryRunId,
    detail: {
      channelsDiscovered: discovered.size,
      candidatesCreated,
      candidatesRejected,
      quotaUnitsUsed,
      sameRunDuplicatesMerged,
    },
  });

  // No new candidates this pass: let the shared finalisation logic decide whether to
  // search again or stop (and record the stop reason).
  if (acceptedCandidateIds.length === 0) {
    await finalizeRunIfDone(discoveryRunId);
  }

  async function upsertCandidate(options: {
    discoveryRunId: string;
    channel: DiscoveredChannel;
    state: "FILTERED_OUT";
    rejectionReason: RejectionReason | null;
    rejectionExpiresAt: Date | null;
    detail: string;
    subscriberCount?: number | null;
  }) {
    const candidate = await prisma.discoveryCandidate.upsert({
      where: {
        discoveryRunId_youtubeChannelId: {
          discoveryRunId: options.discoveryRunId,
          youtubeChannelId: options.channel.youtubeChannelId,
        },
      },
      update: {},
      create: {
        discoveryRunId: options.discoveryRunId,
        discoveryQueryId: options.channel.discoveryQueryId,
        youtubeChannelId: options.channel.youtubeChannelId,
        channelTitle: options.channel.channelTitle,
        state: options.state,
        rejectionReason: options.rejectionReason,
        rejectionExpiresAt: options.rejectionExpiresAt,
        subscriberCountAtDiscovery:
          options.subscriberCount !== null && options.subscriberCount !== undefined
            ? BigInt(options.subscriberCount)
            : null,
      },
    });
    await recordAudit({
      actorType: "worker",
      action: "discovery.candidate.filtered",
      entityType: "DiscoveryCandidate",
      entityId: candidate.id,
      detail: { reason: options.rejectionReason, detail: options.detail },
    });
  }
}

async function haltRunForQuota(jobId: string, discoveryRunId: string, quotaUnitsUsed: number, error: QuotaExhaustedError) {
  await prisma.discoveryRun.update({
    where: { id: discoveryRunId },
    data: { status: "HALTED_QUOTA_LIMIT", quotaUnitsUsed: { increment: quotaUnitsUsed }, errorMessage: error.message },
  });
  // Requeue without consuming an attempt: a quota halt is a system condition, not a
  // failure. The job stays QUEUED but invisible to the claim filter until the run is
  // resumed; replayed search pages are free (reservation keys + candidate upserts).
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "QUEUED", attempts: { decrement: 1 } },
  });
  await recordAudit({
    actorType: "worker",
    action: "discovery.run.halted_quota",
    entityType: "DiscoveryRun",
    entityId: discoveryRunId,
    detail: { message: error.message },
  });
}
