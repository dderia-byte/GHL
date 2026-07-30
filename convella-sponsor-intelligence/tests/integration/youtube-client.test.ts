import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("YouTubeClient (mocked YouTube Data API responses)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.YOUTUBE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("maps a channels.list response into channel metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "UCabc",
            snippet: { title: "Test Channel", description: "desc", customUrl: "@testchannel", thumbnails: { high: { url: "http://x/thumb.jpg" } } },
            statistics: { subscriberCount: "1000", videoCount: "42", hiddenSubscriberCount: false },
            contentDetails: { relatedPlaylists: { uploads: "UUabc" } },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { YouTubeClient } = await import("@/lib/youtube/client");
    const client = new YouTubeClient();
    const channel = await client.getChannelById("UCabc");

    expect(channel.title).toBe("Test Channel");
    expect(channel.uploadsPlaylistId).toBe("UUabc");
    expect(channel.subscriberCount).toBe(1000);
  });

  it("throws a quota-exceeded error on a 403 quotaExceeded response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } }, 403),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { YouTubeClient } = await import("@/lib/youtube/client");
    const { YouTubeQuotaExceededError } = await import("@/lib/youtube/errors");
    const client = new YouTubeClient();

    await expect(client.getChannelById("UCabc")).rejects.toBeInstanceOf(YouTubeQuotaExceededError);
  });

  it("retries transient 500 errors before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "server error" } }, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "vid1",
              snippet: { title: "A video", description: "d", channelId: "UCabc", thumbnails: {}, tags: ["a"] },
              contentDetails: { duration: "PT1M" },
              statistics: { viewCount: "10", likeCount: "2" },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { YouTubeClient } = await import("@/lib/youtube/client");
    const client = new YouTubeClient();
    const video = await client.getVideoById("vid1");

    expect(video.title).toBe("A video");
    expect(video.durationSeconds).toBe(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches repeated channel lookups without re-fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "UCcache",
            snippet: { title: "Cached Channel", description: "", thumbnails: {} },
            statistics: {},
            contentDetails: { relatedPlaylists: { uploads: "UUcache" } },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { YouTubeClient } = await import("@/lib/youtube/client");
    const client = new YouTubeClient();
    await client.getChannelById("UCcache");
    await client.getChannelById("UCcache");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates playlistItems.list until the requested video count is reached", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }],
          nextPageToken: "page2",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "v3" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { YouTubeClient } = await import("@/lib/youtube/client");
    const client = new YouTubeClient();
    const ids = await client.getRecentUploadVideoIds("UUabc", 3);

    expect(ids).toEqual(["v1", "v2", "v3"]);
  });
});
