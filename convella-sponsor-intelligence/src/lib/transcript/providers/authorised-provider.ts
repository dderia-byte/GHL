import type { TranscriptProvider, TranscriptResult } from "../types";

/**
 * Extension point for a future authorised/licensed transcript provider (e.g. a
 * contracted captions API). Intentionally unimplemented — wire up a real, permitted
 * data source here before use. Never use this adapter to scrape or bypass YouTube's
 * technical controls.
 */
export class AuthorisedTranscriptProvider implements TranscriptProvider {
  readonly name = "authorised_provider";

  async getTranscript(_videoId: string): Promise<TranscriptResult> {
    throw new Error(
      "AuthorisedTranscriptProvider has no configured backend. Implement this adapter " +
        "with a licensed transcript source before selecting it.",
    );
  }
}
