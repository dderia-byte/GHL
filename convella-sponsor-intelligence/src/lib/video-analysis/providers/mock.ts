import type {
  AnalysisInputsUsed,
  SponsorRecognitionResult,
  VideoAnalysisContext,
  VideoAnalysisProvider,
  VideoChunk,
} from "../types";

/** The mock provider never has real media — evidence sourced from VIDEO_AUDIO/VIDEO_VISUAL in its scripts is fictional demonstration data, not a claim of real modality analysis. */
const MOCK_ANALYSIS_INPUTS: AnalysisInputsUsed = {
  mediaSourceMethod: "NONE",
  videoInputAnalysed: false,
  nativeAudioAnalysed: false,
  visualFramesAnalysed: false,
  transcriptProvided: false,
  descriptionProvided: false,
  model: "mock",
  providerError: null,
};

const NO_SPONSOR_RESULT: SponsorRecognitionResult = {
  recognised: false,
  brandName: null,
  brandDomain: null,
  placementType: null,
  sponsorshipConfirmed: false,
  confidenceScore: 0,
  startTimestampSeconds: null,
  endTimestampSeconds: null,
  evidence: [],
  reason: "Mock provider: no commercial signal detected in this chunk.",
  analysisInputs: MOCK_ANALYSIS_INPUTS,
};

/** Fictional demonstration script: introduces a brand mention, then confirms it as a sponsor. */
export const DEFAULT_MOCK_SCRIPT: SponsorRecognitionResult[] = [
  {
    ...NO_SPONSOR_RESULT,
    evidence: [
      {
        source: "TRANSCRIPT",
        timestampSeconds: 4,
        text: "Today we're going to be looking at a few developer tools.",
        strength: 0.1,
      },
    ],
    reason: "Mock provider: intro segment, no commercial signal yet.",
    analysisInputs: MOCK_ANALYSIS_INPUTS,
  },
  {
    recognised: true,
    brandName: "CodeRabbit",
    brandDomain: "coderabbit.ai",
    placementType: "SPONSORED_INTEGRATION",
    sponsorshipConfirmed: true,
    confidenceScore: 0.97,
    startTimestampSeconds: 9,
    endTimestampSeconds: 20,
    evidence: [
      {
        source: "VIDEO_AUDIO",
        timestampSeconds: 9,
        text: "Thanks to CodeRabbit for sponsoring today's video.",
        strength: 0.95,
      },
      {
        source: "VIDEO_VISUAL",
        timestampSeconds: 15,
        text: "CodeRabbit logo and product dashboard visible on screen.",
        strength: 0.75,
      },
      {
        source: "TRANSCRIPT",
        timestampSeconds: 14,
        text: "CodeRabbit is an AI code review tool, and you can try it for free at coderabbit.ai.",
        strength: 0.5,
      },
      {
        source: "DESCRIPTION",
        timestampSeconds: null,
        text: "Try CodeRabbit free: https://coderabbit.ai/",
        strength: 0.85,
      },
    ],
    reason:
      "Mock provider: explicit spoken sponsorship disclosure, matching on-screen branding and a matching description link.",
    analysisInputs: MOCK_ANALYSIS_INPUTS,
  },
];

/**
 * Deterministic mock video-analysis provider for local development, seed data and tests.
 * Returns a scripted sequence of chunk results (defaulting to a fictional CodeRabbit
 * sponsorship demonstration) so the full pipeline can be exercised without any external
 * API calls.
 */
export class MockVideoAnalysisProvider implements VideoAnalysisProvider {
  readonly name = "mock";
  private callCount = 0;

  constructor(private readonly script: SponsorRecognitionResult[] = DEFAULT_MOCK_SCRIPT) {}

  async analyseChunk(_chunk: VideoChunk, context: VideoAnalysisContext): Promise<SponsorRecognitionResult> {
    const result = this.script[this.callCount] ?? NO_SPONSOR_RESULT;
    this.callCount += 1;
    return {
      ...result,
      analysisInputs: {
        ...result.analysisInputs,
        transcriptProvided: context.transcriptSegments.length > 0,
        descriptionProvided: context.description.trim().length > 0,
      },
    };
  }
}
