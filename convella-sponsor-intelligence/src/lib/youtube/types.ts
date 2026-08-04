export interface YouTubeChannelResource {
  id: string;
  handle: string | null;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
  /** topicDetails.topicCategories — coarse Wikipedia-URL topic labels, used by the niche filter. */
  topicCategories: string[];
}

/** One search.list result relevant to discovery: the channel it surfaces. */
export interface YouTubeSearchResult {
  channelId: string;
  channelTitle: string;
  /** Set when the search was type=video — the video that surfaced this channel. */
  videoId: string | null;
  videoTitle: string | null;
}

export interface YouTubeSearchPage {
  results: YouTubeSearchResult[];
  nextPageToken: string | null;
  totalResults: number | null;
}

export interface YouTubeSearchOptions {
  searchType: "video" | "channel";
  regionCode?: string;
  relevanceLanguage?: string;
  /** Restrict to content published after this instant (maps to publishedAfter). */
  publishedAfter?: Date;
  maxResults?: number;
  pageToken?: string;
}

export interface YouTubeVideoResource {
  id: string;
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  tags: string[];
  paidProductPlacement: boolean;
  /** Livestream replay/premiere — excluded from sponsorship analysis. */
  isLivestream: boolean;
}
