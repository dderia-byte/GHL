import { getEnv } from "@/lib/env";
import { youtubeClient } from "./client";
import type { YouTubeSearchOptions, YouTubeSearchPage } from "./types";

/**
 * Search sits behind its own provider interface (matching the transcript /
 * video-analysis provider convention) so discovery runs end-to-end with zero API
 * keys: the mock returns deterministic fictional creators.
 */
export interface YouTubeSearchProvider {
  readonly name: string;
  search(query: string, options: YouTubeSearchOptions): Promise<YouTubeSearchPage>;
}

class RealYouTubeSearchProvider implements YouTubeSearchProvider {
  readonly name = "youtube";
  search(query: string, options: YouTubeSearchOptions): Promise<YouTubeSearchPage> {
    return youtubeClient.searchCreators(query, options);
  }
}

/**
 * Deterministic fixture results for keyless development and tests. All channels are
 * FICTIONAL (per the repository's seed-data policy) and their IDs align with the
 * mock hydration fixtures in tests/e2e/mock-youtube-server.ts where applicable.
 */
export class MockYouTubeSearchProvider implements YouTubeSearchProvider {
  readonly name = "mock";

  async search(query: string, _options: YouTubeSearchOptions): Promise<YouTubeSearchPage> {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
    // Three fictional creators per query, IDs derived from the query so different
    // queries surface different (but stable) channels, with one deliberate overlap
    // channel shared by every query to exercise intra-run deduplication.
    const results = [
      {
        channelId: `UCmock-${slug}-alpha00000000`,
        channelTitle: `Fictional Creator Alpha (${query})`,
        videoId: `mockvid-${slug}-a`,
        videoTitle: `Fictional video about ${query}`,
      },
      {
        channelId: `UCmock-${slug}-beta000000000`,
        channelTitle: `Fictional Creator Beta (${query})`,
        videoId: `mockvid-${slug}-b`,
        videoTitle: `Another fictional video about ${query}`,
      },
      {
        channelId: "UCmock-shared-overlap0000000",
        channelTitle: "Fictional Overlap Creator",
        videoId: `mockvid-${slug}-shared`,
        videoTitle: `Fictional overlap video about ${query}`,
      },
    ];
    return { results, nextPageToken: null, totalResults: results.length };
  }
}

let cachedProvider: YouTubeSearchProvider | null = null;

export function getYouTubeSearchProvider(): YouTubeSearchProvider {
  if (cachedProvider) return cachedProvider;
  const env = getEnv();
  cachedProvider =
    env.DISCOVERY_SEARCH_PROVIDER === "mock" || !env.YOUTUBE_API_KEY
      ? new MockYouTubeSearchProvider()
      : new RealYouTubeSearchProvider();
  return cachedProvider;
}

/** Test hook. */
export function resetYouTubeSearchProvider(): void {
  cachedProvider = null;
}
