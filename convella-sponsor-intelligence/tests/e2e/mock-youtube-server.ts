import { createServer } from "node:http";
import type { Server } from "node:http";

/**
 * Minimal fake YouTube Data API v3 server for Playwright E2E tests. Serves one
 * fictional channel with one fictional short video, so the "add channel" flow can be
 * exercised end-to-end without calling the real YouTube API or requiring credentials.
 */
export const MOCK_CHANNEL_HANDLE = "@e2efictionalcreator";
export const MOCK_VIDEO_TITLE = "E2E Fictional Sponsor Test Video";

const CHANNEL_ID = "UCE2EFICTIONALCHANNEL0001";
const UPLOADS_PLAYLIST_ID = "UUE2EFICTIONALCHANNEL0001";
const VIDEO_ID = "E2EFICTIONAL1";

const CHANNEL_RESPONSE = {
  items: [
    {
      id: CHANNEL_ID,
      snippet: {
        title: "E2E Fictional Creator",
        description: "A fictional channel used only for automated end-to-end testing.",
        customUrl: MOCK_CHANNEL_HANDLE,
        thumbnails: {},
      },
      statistics: { subscriberCount: "5000", videoCount: "1", hiddenSubscriberCount: false },
      contentDetails: { relatedPlaylists: { uploads: UPLOADS_PLAYLIST_ID } },
    },
  ],
};

const PLAYLIST_ITEMS_RESPONSE = {
  items: [{ contentDetails: { videoId: VIDEO_ID } }],
};

const VIDEOS_RESPONSE = {
  items: [
    {
      id: VIDEO_ID,
      snippet: {
        title: MOCK_VIDEO_TITLE,
        description: "Thanks to CodeRabbit for sponsoring today's video! Try it free at https://coderabbit.ai/.",
        publishedAt: new Date().toISOString(),
        channelId: CHANNEL_ID,
        thumbnails: {},
        tags: ["testing"],
      },
      contentDetails: { duration: "PT45S" },
      statistics: { viewCount: "123", likeCount: "10" },
      paidProductPlacementDetails: { hasPaidProductPlacement: true },
    },
  ],
};

export function startMockYouTubeServer(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Content-Type", "application/json");

    if (url.pathname.endsWith("/channels")) {
      res.end(JSON.stringify(CHANNEL_RESPONSE));
    } else if (url.pathname.endsWith("/playlistItems")) {
      res.end(JSON.stringify(PLAYLIST_ITEMS_RESPONSE));
    } else if (url.pathname.endsWith("/videos")) {
      res.end(JSON.stringify(VIDEOS_RESPONSE));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 404, message: "not found" } }));
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => resolve(server));
  });
}
