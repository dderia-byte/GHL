import React from "react";
import { Composition } from "remotion";
import "./styles/global.css";
import { FPS } from "./config/timeline";
import { audioSyncedDurationFrames } from "./config/audio-timeline";
import { EvantixLandscape } from "./compositions/EvantixLandscape";
import { EvantixPortrait } from "./compositions/EvantixPortrait";

// Both compositions share the exact same narration-synced duration and
// timing (see src/config/audio-timeline.ts), so portrait and landscape
// never drift apart.
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="EvantixLandscape"
        component={EvantixLandscape}
        durationInFrames={audioSyncedDurationFrames}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="EvantixPortrait"
        component={EvantixPortrait}
        durationInFrames={audioSyncedDurationFrames}
        fps={FPS}
        width={1080}
        height={1350}
      />
    </>
  );
};
