import type { TranscriptProvider, TranscriptResult, TranscriptSegmentInput } from "../types";

const DEFAULT_FIXTURE: TranscriptSegmentInput[] = [
  { text: "Hey everyone, welcome back to the channel.", startSeconds: 0, durationSeconds: 4 },
  { text: "Today we're going to be looking at a few developer tools.", startSeconds: 4, durationSeconds: 5 },
  {
    text: "But first, thanks to CodeRabbit for sponsoring today's video.",
    startSeconds: 9,
    durationSeconds: 5,
  },
  {
    text: "CodeRabbit is an AI code review tool, and you can try it for free at coderabbit.ai.",
    startSeconds: 14,
    durationSeconds: 6,
  },
  { text: "Alright, let's get into the tutorial.", startSeconds: 20, durationSeconds: 3 },
];

/**
 * Development/testing fixture provider. Returns a deterministic fictional transcript
 * so the analysis pipeline can be exercised without any external transcript source.
 */
export class MockTranscriptProvider implements TranscriptProvider {
  readonly name = "mock";

  constructor(private readonly fixture: TranscriptSegmentInput[] = DEFAULT_FIXTURE) {}

  async getTranscript(_videoId: string): Promise<TranscriptResult> {
    return {
      status: "AVAILABLE",
      source: this.name,
      language: "en",
      segments: this.fixture,
      fullText: this.fixture.map((s) => s.text).join(" "),
    };
  }
}
