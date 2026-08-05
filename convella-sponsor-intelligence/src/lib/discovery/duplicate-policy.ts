/**
 * The duplicate policy, kept pure so it can be reasoned about and tested without a
 * database.
 *
 * Deduplication is scoped to ONE RUN and nothing more. A creator found under three
 * keywords in the same run is analysed once and exported once; the same creator found
 * again next week is a legitimate new result, because they may have signed a sponsor
 * since. SQL is analysis history and cache, never a blocklist.
 *
 * `Channel.qualifiedAt` and `DiscoveryCandidate.rejectionExpiresAt` are still written
 * — they record what happened and when — but neither is consulted here.
 */

export type DiscoveryDisposition =
  /** Not seen yet in this run: analyse. */
  | { action: "ANALYSE" }
  /** Already a candidate in THIS run (another keyword, or an earlier pass). */
  | { action: "MERGE" };

export interface DiscoveryDispositionInput {
  youtubeChannelId: string;
  /** Channel ids this run has already created a candidate for. */
  candidateIdsThisRun: ReadonlySet<string>;
}

export function classifyDiscovery(input: DiscoveryDispositionInput): DiscoveryDisposition {
  return input.candidateIdsThisRun.has(input.youtubeChannelId) ? { action: "MERGE" } : { action: "ANALYSE" };
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
