import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisInputsPanel } from "@/app/videos/[videoId]/analysis-inputs-panel";
import type { AnalysisInputsUsed } from "@/lib/video-analysis/types";

const REAL_VIDEO_ANALYSIS: AnalysisInputsUsed = {
  mediaSourceMethod: "YOUTUBE_URL",
  videoInputAnalysed: true,
  nativeAudioAnalysed: true,
  visualFramesAnalysed: true,
  transcriptProvided: false,
  descriptionProvided: true,
  model: "gemini-flash-latest",
  providerError: null,
};

const TEXT_ONLY_ANALYSIS: AnalysisInputsUsed = {
  mediaSourceMethod: "NONE",
  videoInputAnalysed: false,
  nativeAudioAnalysed: false,
  visualFramesAnalysed: false,
  transcriptProvided: true,
  descriptionProvided: true,
  model: "gemini-flash-latest",
  providerError: "Gemini could not access the public YouTube video. Native audio and visuals were not analysed. (video unavailable)",
};

describe("AnalysisInputsPanel", () => {
  it("shows 'Not analysed yet.' when the video has never been analysed", () => {
    const html = renderToStaticMarkup(<AnalysisInputsPanel analysisInputs={null} />);
    expect(html).toContain("Not analysed yet.");
  });

  it("accurately displays real native video/audio/visual analysis as Yes", () => {
    const html = renderToStaticMarkup(<AnalysisInputsPanel analysisInputs={REAL_VIDEO_ANALYSIS} />);

    expect(html).toContain("Public YouTube video");
    expect(html).toContain("Native audio");
    expect(html).toContain("Visual frames");
    expect(html).toContain("gemini-flash-latest");
    expect(html).toContain("Public YouTube URL (native video input)");
    // Three "Yes" badges (video/audio/visual) plus one for description = 4; transcript is No.
    expect((html.match(/>Yes</g) ?? []).length).toBe(4);
    expect((html.match(/>No</g) ?? []).length).toBe(1);
  });

  it("never shows 'Native audio: Yes' merely because a transcript was available — text-only runs show No across the board and surface the fallback message", () => {
    const html = renderToStaticMarkup(<AnalysisInputsPanel analysisInputs={TEXT_ONLY_ANALYSIS} />);

    // transcriptProvided is true here, but video/audio/visual must all still read No.
    expect((html.match(/>No</g) ?? []).length).toBe(3);
    expect(html).toContain("None — text only");
    expect(html).toContain("Gemini could not access the public YouTube video");
  });
});
