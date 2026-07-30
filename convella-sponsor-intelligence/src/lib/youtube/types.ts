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
}
