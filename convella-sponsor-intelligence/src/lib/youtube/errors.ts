export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export class YouTubeQuotaExceededError extends YouTubeApiError {
  constructor() {
    super(
      "The YouTube Data API quota has been exhausted for today. Try again after the daily quota resets (midnight Pacific Time), or request a quota increase from Google Cloud Console.",
      403,
      "quotaExceeded",
    );
    this.name = "YouTubeQuotaExceededError";
  }
}

export class YouTubeNotFoundError extends YouTubeApiError {
  constructor(resource: string) {
    super(`${resource} was not found. It may be private, deleted, or the identifier may be incorrect.`, 404);
    this.name = "YouTubeNotFoundError";
  }
}
