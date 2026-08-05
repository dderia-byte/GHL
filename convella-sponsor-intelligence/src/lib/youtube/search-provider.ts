import { getEnv } from "@/lib/env";
import { youtubeClient } from "./client";
import type {
  YouTubeChannelResource,
  YouTubeSearchOptions,
  YouTubeSearchPage,
  YouTubeVideoResource,
} from "./types";

/**
 * Search sits behind its own provider interface (matching the transcript /
 * video-analysis provider convention) so discovery runs end-to-end with zero API
 * keys: the mock returns deterministic fictional creators. The optional hydration
 * methods exist only so the mock can supply channel/upload fixtures too — the real
 * provider leaves them undefined and discovery uses the real YouTubeClient
 * (batched channels.list / uploads playlist) instead.
 */
export interface YouTubeSearchProvider {
  readonly name: string;
  search(query: string, options: YouTubeSearchOptions): Promise<YouTubeSearchPage>;
  getChannels?(channelIds: string[]): Promise<YouTubeChannelResource[]>;
  getRecentUploads?(youtubeChannelId: string, count: number): Promise<YouTubeVideoResource[]>;
}

class RealYouTubeSearchProvider implements YouTubeSearchProvider {
  readonly name = "youtube";
  search(query: string, options: YouTubeSearchOptions): Promise<YouTubeSearchPage> {
    return youtubeClient.searchCreators(query, options);
  }
}

// ---------------------------------------------------------------------------
// Mock fixtures — ALL FICTIONAL (per the repository's seed-data policy).
// The four creator archetypes deliberately exercise every branch of the
// qualification decision tree:
//   alpha   → newest video sponsored, plus a Short and a livestream replay that
//             must be filtered out as ineligible, and a 2nd sponsor further down
//   beta    → newest affiliate-only, 2nd video sponsored
//   buried  → sponsors only in older uploads
//   overlap → returned by EVERY query (dedup), no sponsors at all
//   giant   → 2.4M subscribers                                 → filtered SUBSCRIBERS_OVER_CAP
// ---------------------------------------------------------------------------

type MockArchetype = "alpha" | "beta" | "overlap" | "giant" | "buried";

function archetypeOf(channelId: string): MockArchetype {
  if (channelId.includes("-beta")) return "beta";
  if (channelId.includes("overlap")) return "overlap";
  if (channelId.includes("-giant")) return "giant";
  if (channelId.includes("-buried")) return "buried";
  return "alpha";
}

function sponsoredDescription(brand: string, domain: string): string {
  return `This video is sponsored by ${brand}. Try ${brand} free at https://${domain}/ (fictional demo sponsor).`;
}

function mockChannel(channelId: string, title: string): YouTubeChannelResource {
  const archetype = archetypeOf(channelId);
  const subscriberCount =
    archetype === "giant" ? 2_400_000 : archetype === "alpha" ? 250_000 : archetype === "beta" ? 120_000 : 45_000;
  return {
    id: channelId,
    handle: null,
    title,
    description: `Fictional ${archetype} demo creator used by the mock discovery provider. Not a real channel.`,
    thumbnailUrl: null,
    subscriberCount,
    hiddenSubscriberCount: false,
    videoCount: 40,
    uploadsPlaylistId: `UUmock-${channelId.slice(2)}`,
    topicCategories: ["https://en.wikipedia.org/wiki/Technology"],
  };
}

function mockVideo(
  channelId: string,
  index: number,
  overrides: Partial<YouTubeVideoResource>,
): YouTubeVideoResource {
  const daysAgo = 2 + index * 6;
  return {
    id: `mockvid-${channelId.slice(2)}-${index}`,
    channelId,
    title: `Fictional demo video #${index + 1}`,
    description: "A plain fictional demo video with no commercial content.",
    thumbnailUrl: null,
    publishedAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString(),
    durationSeconds: 480,
    viewCount: 12_000,
    likeCount: 800,
    tags: [],
    paidProductPlacement: false,
    isLivestream: false,
    ...overrides,
  };
}

function mockUploads(channelId: string, count: number): YouTubeVideoResource[] {
  const archetype = archetypeOf(channelId);
  const videos: YouTubeVideoResource[] = [];

  for (let i = 0; i < count; i += 1) {
    if (archetype === "alpha" && i === 0) {
      videos.push(
        mockVideo(channelId, i, {
          title: "I rebuilt my entire workflow (fictional demo)",
          description: sponsoredDescription("Nimbus Notes", "nimbusnotes.example.com"),
          durationSeconds: 620,
        }),
      );
    } else if (archetype === "alpha" && i === 1) {
      // Ineligible: a Short. Must be filtered out before analysis.
      videos.push(
        mockVideo(channelId, i, { title: "Quick tip #shorts (fictional demo)", durationSeconds: 45 }),
      );
    } else if (archetype === "alpha" && i === 4) {
      // Ineligible: a livestream replay. Must be filtered out before analysis.
      videos.push(
        mockVideo(channelId, i, { title: "Live Q&A replay (fictional demo)", durationSeconds: 7200, isLivestream: true }),
      );
    } else if (archetype === "alpha" && i === 2) {
      videos.push(
        mockVideo(channelId, i, {
          title: "My honest review setup (fictional demo)",
          description: sponsoredDescription("Voltcharge", "voltcharge.example.com"),
          durationSeconds: 540,
        }),
      );
    } else if (archetype === "beta" && i === 0) {
      videos.push(
        mockVideo(channelId, i, {
          title: "My favourite gear this month (fictional demo)",
          description:
            "Gear list below. Use code BETA10 for 10% off. Some of the links below are affiliate links (fictional demo).",
        }),
      );
    } else if (archetype === "beta" && i === 1) {
      videos.push(
        mockVideo(channelId, i, {
          title: "How I stay private online (fictional demo)",
          description: sponsoredDescription("Aurora VPN", "auroravpn.example.com"),
          durationSeconds: 480,
        }),
      );
    } else if (archetype === "buried" && i === 3) {
      // The realistic case: a creator who takes sponsorships but whose most recent
      // uploads happen to be unsponsored. Gating on the newest video alone would
      // wrongly reject them; the free description gate finds this one for $0.
      videos.push(
        mockVideo(channelId, i, {
          title: "The tool that changed my workflow (fictional demo)",
          description: sponsoredDescription("Deepcurrent", "deepcurrent.example.com"),
          durationSeconds: 700,
        }),
      );
    } else {
      videos.push(mockVideo(channelId, i, {}));
    }
  }

  return videos;
}

/** Deterministic fictional search results for keyless development and tests. */
export class MockYouTubeSearchProvider implements YouTubeSearchProvider {
  readonly name = "mock";

  async search(query: string, _options: YouTubeSearchOptions): Promise<YouTubeSearchPage> {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
    const results = [
      {
        channelId: `UCmock-${slug}-alpha`,
        channelTitle: `Fictional Creator Alpha (${query})`,
        videoId: `mockvid-${slug}-a`,
        videoTitle: `Fictional video about ${query}`,
      },
      {
        channelId: `UCmock-${slug}-beta`,
        channelTitle: `Fictional Creator Beta (${query})`,
        videoId: `mockvid-${slug}-b`,
        videoTitle: `Another fictional video about ${query}`,
      },
      {
        channelId: `UCmock-${slug}-giant`,
        channelTitle: `Fictional Mega Creator (${query})`,
        videoId: `mockvid-${slug}-g`,
        videoTitle: `Fictional viral video about ${query}`,
      },
      {
        channelId: `UCmock-${slug}-buried`,
        channelTitle: `Fictional Buried-Sponsor Creator (${query})`,
        videoId: `mockvid-${slug}-bu`,
        videoTitle: `Fictional older-sponsor video about ${query}`,
      },
      {
        channelId: "UCmock-shared-overlap",
        channelTitle: "Fictional Overlap Creator",
        videoId: `mockvid-${slug}-s`,
        videoTitle: `Fictional overlap video about ${query}`,
      },
    ];
    return { results, nextPageToken: null, totalResults: results.length };
  }

  async getChannels(channelIds: string[]): Promise<YouTubeChannelResource[]> {
    return channelIds.map((id) => {
      const archetype = archetypeOf(id);
      const title =
        archetype === "overlap"
          ? "Fictional Overlap Creator"
          : `Fictional ${archetype[0].toUpperCase()}${archetype.slice(1)} Creator`;
      return mockChannel(id, title);
    });
  }

  async getRecentUploads(youtubeChannelId: string, count: number): Promise<YouTubeVideoResource[]> {
    return mockUploads(youtubeChannelId, count);
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
