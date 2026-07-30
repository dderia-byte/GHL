import { youtubeClient } from "./client";
import type { ParsedChannelInput } from "./parse";
import type { YouTubeChannelResource } from "./types";

/** Resolves a parsed channel reference (ID, @handle, or legacy username) to canonical channel metadata. */
export async function resolveChannelRef(ref: ParsedChannelInput["ref"]): Promise<YouTubeChannelResource> {
  switch (ref.kind) {
    case "channel_id":
      return youtubeClient.getChannelById(ref.value);
    case "handle":
      return youtubeClient.getChannelByHandle(ref.value);
    case "username":
      return youtubeClient.getChannelByUsername(ref.value);
  }
}
