export interface YouTubeMetadataSignals {
  paidProductPlacement: boolean;
  matchingTags: string[];
}

export interface VideoMetadataForSignals {
  paidProductPlacement: boolean;
  tags: string[];
  title: string;
}

const SPONSOR_TAG_KEYWORDS = ["sponsor", "sponsored", "ad", "advertisement", "partner"];

/**
 * Inspects official YouTube metadata (paid-product-placement flag, tags, title) for
 * commercial signals. This alone is treated as a supporting signal, never sufficient
 * on its own to confirm a sponsorship.
 */
export function analyseYouTubeMetadata(video: VideoMetadataForSignals): YouTubeMetadataSignals {
  const matchingTags = video.tags.filter((tag) =>
    SPONSOR_TAG_KEYWORDS.some((keyword) => tag.toLowerCase().includes(keyword)),
  );

  return {
    paidProductPlacement: video.paidProductPlacement,
    matchingTags,
  };
}
