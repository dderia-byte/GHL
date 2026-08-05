/**
 * The duplicate policy, kept pure so it can be reasoned about and tested without a
 * database.
 *
 * The distinction that matters: search-result duplication is NOT disqualifying.
 * A creator who shows up under three different search keywords is one creator found
 * three times, not three duplicates — they get analysed once and exported once.
 * Only a creator the permanent database already holds from a PREVIOUS completed run
 * is a real duplicate.
 */

export type DiscoveryDisposition =
  | { action: "ANALYSE" }
  /** Already a candidate in this same run (another keyword, or an earlier pass). */
  | { action: "MERGE" }
  | { action: "SKIP"; reason: "DUPLICATE_KNOWN" | "DUPLICATE_REJECTED"; detail: string };

export interface DiscoveryDispositionInput {
  youtubeChannelId: string;
  /** Channel ids this run has already created a candidate for. */
  candidateIdsThisRun: ReadonlySet<string>;
  /** Channel ids a previous run qualified and exported (Channel.qualifiedAt set). */
  exportedChannelIds: ReadonlySet<string>;
  /** Channel ids a previous run rejected, still inside the cooldown window. */
  cooldownRejectedIds: ReadonlySet<string>;
}

export function classifyDiscovery(input: DiscoveryDispositionInput): DiscoveryDisposition {
  const { youtubeChannelId, candidateIdsThisRun, exportedChannelIds, cooldownRejectedIds } = input;

  // Checked FIRST and deliberately: a channel this run is already working on must
  // never fall through to a rejection branch, whichever keyword re-found them.
  if (candidateIdsThisRun.has(youtubeChannelId)) {
    return { action: "MERGE" };
  }

  if (exportedChannelIds.has(youtubeChannelId)) {
    return {
      action: "SKIP",
      reason: "DUPLICATE_KNOWN",
      detail: "Creator was already qualified and exported by a previous run.",
    };
  }

  if (cooldownRejectedIds.has(youtubeChannelId)) {
    return {
      action: "SKIP",
      reason: "DUPLICATE_REJECTED",
      detail: "Creator was rejected by a previous run (cooldown active).",
    };
  }

  return { action: "ANALYSE" };
}

/**
 * Collapses raw search hits into one entry per channel id. The first hit wins the
 * provenance (which query found them); every later hit for the same channel is
 * dropped rather than becoming a second candidate.
 */
export function mergeDiscoveriesByChannel<T extends { youtubeChannelId: string }>(hits: Iterable<T>): T[] {
  const byChannel = new Map<string, T>();
  for (const hit of hits) {
    if (!byChannel.has(hit.youtubeChannelId)) byChannel.set(hit.youtubeChannelId, hit);
  }
  return Array.from(byChannel.values());
}
