export class YouTubeInputParseError extends Error {}

export interface ParsedVideoInput {
  type: "video";
  videoId: string;
}

export interface ParsedChannelInput {
  type: "channel";
  ref:
    | { kind: "channel_id"; value: string }
    | { kind: "handle"; value: string }
    | { kind: "username"; value: string };
}

export type ParsedYouTubeInput = ParsedVideoInput | ParsedChannelInput;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE_PATTERN = /^@[\w.-]{2,30}$/;

function extractVideoIdFromUrl(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (!/(^|\.)youtube\.com$/.test(url.hostname) && !/(^|\.)youtube-nocookie\.com$/.test(url.hostname)) {
    return null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  const liveMatch = url.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  return null;
}

function extractChannelRefFromUrl(url: URL): ParsedChannelInput["ref"] | null {
  const channelMatch = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (channelMatch) return { kind: "channel_id", value: channelMatch[1] };

  const handleMatch = url.pathname.match(/^\/(@[\w.-]{2,30})/);
  if (handleMatch) return { kind: "handle", value: handleMatch[1] };

  const userMatch = url.pathname.match(/^\/user\/([\w.-]{2,30})/);
  if (userMatch) return { kind: "username", value: userMatch[1] };

  const customMatch = url.pathname.match(/^\/c\/([\w.-]{2,30})/);
  if (customMatch) return { kind: "username", value: customMatch[1] };

  return null;
}

/**
 * Parses a YouTube channel URL, handle, channel ID, video URL, or bare video ID into
 * a canonical reference the YouTube Data API can resolve. Throws YouTubeInputParseError
 * with a user-facing message when the input cannot be interpreted.
 */
export function parseYouTubeInput(raw: string): ParsedYouTubeInput {
  const trimmed = raw.trim();
  if (!trimmed) throw new YouTubeInputParseError("Please enter a YouTube channel URL, handle, channel ID, or video URL.");

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new YouTubeInputParseError("That does not look like a valid URL.");
    }

    const videoId = extractVideoIdFromUrl(url);
    if (videoId) return { type: "video", videoId };

    const channelRef = extractChannelRefFromUrl(url);
    if (channelRef) return { type: "channel", ref: channelRef };

    throw new YouTubeInputParseError(
      "Could not recognise a YouTube channel or video in that URL. Supported formats: /channel/UC..., /@handle, /watch?v=..., youtu.be/....",
    );
  }

  if (CHANNEL_ID_PATTERN.test(trimmed)) return { type: "channel", ref: { kind: "channel_id", value: trimmed } };
  if (HANDLE_PATTERN.test(trimmed)) return { type: "channel", ref: { kind: "handle", value: trimmed } };
  if (VIDEO_ID_PATTERN.test(trimmed) && !trimmed.startsWith("@")) {
    return { type: "video", videoId: trimmed };
  }

  throw new YouTubeInputParseError(
    "Enter a full YouTube channel URL, an @handle, a channel ID (starting with UC), or a video URL.",
  );
}

/** Builds a clickable, timestamped YouTube URL. Never fabricates a timestamp — pass null to omit it. */
export function buildTimestampedVideoUrl(videoId: string, seconds: number | null): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  if (seconds === null || seconds < 0) return base;
  return `${base}&t=${Math.floor(seconds)}s`;
}
