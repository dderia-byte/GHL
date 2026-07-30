import { getEnv } from "@/lib/env";
import { parseIso8601Duration } from "./duration";
import { YouTubeApiError, YouTubeNotFoundError, YouTubeQuotaExceededError } from "./errors";
import { TtlCache } from "./cache";
import type { YouTubeChannelResource, YouTubeVideoResource } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

interface YouTubeErrorBody {
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> };
}

async function requestWithRetry(path: string, params: Record<string, string>): Promise<unknown> {
  const env = getEnv();
  if (!env.YOUTUBE_API_KEY) {
    throw new YouTubeApiError(
      "YOUTUBE_API_KEY is not configured. Add it to your environment to use the YouTube Data API.",
      401,
    );
  }

  const url = new URL(`${env.YOUTUBE_API_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", env.YOUTUBE_API_KEY);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url.toString());
    if (response.ok) return response.json();

    const body = (await response.json().catch(() => ({}))) as YouTubeErrorBody;
    const reason = body.error?.errors?.[0]?.reason;

    if (response.status === 403 && (reason === "quotaExceeded" || reason === "dailyLimitExceeded")) {
      throw new YouTubeQuotaExceededError();
    }

    if (response.status === 404) {
      throw new YouTubeNotFoundError("The requested YouTube resource");
    }

    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt === MAX_RETRIES) {
      throw new YouTubeApiError(
        body.error?.message ?? `YouTube API request failed with status ${response.status}`,
        response.status,
        reason,
      );
    }

    lastError = new Error(body.error?.message ?? `status ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));
  }

  throw lastError ?? new Error("YouTube API request failed");
}

function mapChannelResource(item: Record<string, unknown>): YouTubeChannelResource {
  const snippet = (item.snippet ?? {}) as Record<string, unknown>;
  const statistics = (item.statistics ?? {}) as Record<string, unknown>;
  const contentDetails = (item.contentDetails ?? {}) as Record<string, unknown>;
  const thumbnails = (snippet.thumbnails ?? {}) as Record<string, { url?: string }>;
  const relatedPlaylists = (contentDetails.relatedPlaylists ?? {}) as Record<string, unknown>;

  return {
    id: String(item.id),
    handle: typeof snippet.customUrl === "string" ? snippet.customUrl : null,
    title: String(snippet.title ?? ""),
    description: String(snippet.description ?? ""),
    thumbnailUrl: thumbnails.high?.url ?? thumbnails.default?.url ?? null,
    subscriberCount: statistics.subscriberCount ? Number(statistics.subscriberCount) : null,
    hiddenSubscriberCount: Boolean(statistics.hiddenSubscriberCount),
    videoCount: statistics.videoCount ? Number(statistics.videoCount) : null,
    uploadsPlaylistId: typeof relatedPlaylists.uploads === "string" ? relatedPlaylists.uploads : null,
  };
}

function mapVideoResource(item: Record<string, unknown>): YouTubeVideoResource {
  const snippet = (item.snippet ?? {}) as Record<string, unknown>;
  const statistics = (item.statistics ?? {}) as Record<string, unknown>;
  const contentDetails = (item.contentDetails ?? {}) as Record<string, unknown>;
  const thumbnails = (snippet.thumbnails ?? {}) as Record<string, { url?: string }>;
  const paidProductPlacementDetails = (item.paidProductPlacementDetails ?? {}) as Record<string, unknown>;

  return {
    id: String(item.id),
    channelId: String(snippet.channelId ?? ""),
    title: String(snippet.title ?? ""),
    description: String(snippet.description ?? ""),
    thumbnailUrl: thumbnails.high?.url ?? thumbnails.default?.url ?? null,
    publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
    durationSeconds:
      typeof contentDetails.duration === "string" ? parseIso8601Duration(contentDetails.duration) : null,
    viewCount: statistics.viewCount ? Number(statistics.viewCount) : null,
    likeCount: statistics.likeCount ? Number(statistics.likeCount) : null,
    tags: Array.isArray(snippet.tags) ? (snippet.tags as string[]) : [],
    paidProductPlacement: Boolean(paidProductPlacementDetails.hasPaidProductPlacement),
  };
}

const channelCache = new TtlCache<YouTubeChannelResource>(CACHE_TTL_MS);
const videoCache = new TtlCache<YouTubeVideoResource>(CACHE_TTL_MS);

const CHANNEL_PARTS = "snippet,statistics,contentDetails";
const VIDEO_PARTS = "snippet,statistics,contentDetails,paidProductPlacementDetails";

/**
 * Thin, quota-aware wrapper around the official YouTube Data API v3. Prefers cheap
 * list/lookup calls (channels.list, playlistItems.list, batched videos.list) over
 * expensive search.list requests, and never scrapes or bypasses YouTube directly.
 */
export class YouTubeClient {
  async getChannelById(channelId: string): Promise<YouTubeChannelResource> {
    const cached = channelCache.get(channelId);
    if (cached) return cached;

    const data = (await requestWithRetry("channels", { part: CHANNEL_PARTS, id: channelId })) as {
      items?: Array<Record<string, unknown>>;
    };
    if (!data.items?.length) throw new YouTubeNotFoundError("That YouTube channel");

    const channel = mapChannelResource(data.items[0]);
    channelCache.set(channelId, channel);
    return channel;
  }

  async getChannelByHandle(handle: string): Promise<YouTubeChannelResource> {
    const cacheKey = `handle:${handle}`;
    const cached = channelCache.get(cacheKey);
    if (cached) return cached;

    const data = (await requestWithRetry("channels", { part: CHANNEL_PARTS, forHandle: handle })) as {
      items?: Array<Record<string, unknown>>;
    };
    if (!data.items?.length) throw new YouTubeNotFoundError(`The channel for handle ${handle}`);

    const channel = mapChannelResource(data.items[0]);
    channelCache.set(cacheKey, channel);
    channelCache.set(channel.id, channel);
    return channel;
  }

  async getChannelByUsername(username: string): Promise<YouTubeChannelResource> {
    const cacheKey = `username:${username}`;
    const cached = channelCache.get(cacheKey);
    if (cached) return cached;

    const data = (await requestWithRetry("channels", { part: CHANNEL_PARTS, forUsername: username })) as {
      items?: Array<Record<string, unknown>>;
    };
    if (!data.items?.length) {
      throw new YouTubeNotFoundError(
        `The channel for username/custom URL "${username}" (legacy custom URLs cannot always be resolved by the API — try the @handle or channel ID instead)`,
      );
    }

    const channel = mapChannelResource(data.items[0]);
    channelCache.set(cacheKey, channel);
    channelCache.set(channel.id, channel);
    return channel;
  }

  /** Retrieves up to `maxResults` recent video IDs from a channel's uploads playlist. */
  async getRecentUploadVideoIds(uploadsPlaylistId: string, maxResults: number): Promise<string[]> {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    while (videoIds.length < maxResults) {
      const remaining = maxResults - videoIds.length;
      const data = (await requestWithRetry("playlistItems", {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(Math.min(50, remaining)),
        ...(pageToken ? { pageToken } : {}),
      })) as { items?: Array<{ contentDetails?: { videoId?: string } }>; nextPageToken?: string };

      for (const item of data.items ?? []) {
        if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
      }

      if (!data.nextPageToken || !data.items?.length) break;
      pageToken = data.nextPageToken;
    }

    return videoIds.slice(0, maxResults);
  }

  /** Batched videos.list lookup (up to 50 IDs per request, per YouTube API limits). */
  async getVideosByIds(videoIds: string[]): Promise<YouTubeVideoResource[]> {
    const uncached = videoIds.filter((id) => !videoCache.get(id));
    const results = new Map<string, YouTubeVideoResource>();

    for (const id of videoIds) {
      const cached = videoCache.get(id);
      if (cached) results.set(id, cached);
    }

    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const data = (await requestWithRetry("videos", { part: VIDEO_PARTS, id: batch.join(",") })) as {
        items?: Array<Record<string, unknown>>;
      };

      for (const item of data.items ?? []) {
        const video = mapVideoResource(item);
        videoCache.set(video.id, video);
        results.set(video.id, video);
      }
    }

    return videoIds.map((id) => results.get(id)).filter((v): v is YouTubeVideoResource => Boolean(v));
  }

  async getVideoById(videoId: string): Promise<YouTubeVideoResource> {
    const videos = await this.getVideosByIds([videoId]);
    if (!videos.length) throw new YouTubeNotFoundError("That YouTube video");
    return videos[0];
  }
}

export const youtubeClient = new YouTubeClient();
