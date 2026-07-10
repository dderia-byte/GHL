import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionPresentation } from "@remotion/transitions";

import { SCENES, transitionFrames, TransitionKind } from "../config/timeline";
import { AUDIO_TIMELINE } from "../config/audio-timeline";
import { EvantixAudio } from "../audio/EvantixAudio";

import { Scene01Intro } from "../scenes/Scene01Intro";
import { Scene02Problem } from "../scenes/Scene02Problem";
import { Scene03LeadsLost } from "../scenes/Scene03LeadsLost";
import { Scene04Bottleneck } from "../scenes/Scene04Bottleneck";
import { Scene05Connects } from "../scenes/Scene05Connects";
import { Scene06Application } from "../scenes/Scene06Application";
import { Scene07Profile } from "../scenes/Scene07Profile";
import { Scene08Scoring } from "../scenes/Scene08Scoring";
import { Scene09Response } from "../scenes/Scene09Response";
import { Scene10Booking } from "../scenes/Scene10Booking";
import { Scene11Pipeline } from "../scenes/Scene11Pipeline";
import { Scene12Workflow } from "../scenes/Scene12Workflow";
import { Scene13Compliance } from "../scenes/Scene13Compliance";
import { Scene14Tasks } from "../scenes/Scene14Tasks";
import { Scene15Clients } from "../scenes/Scene15Clients";
import { Scene16Matching } from "../scenes/Scene16Matching";
import { Scene17Dashboard } from "../scenes/Scene17Dashboard";
import { Scene18Transformation } from "../scenes/Scene18Transformation";
import { Scene19Journey } from "../scenes/Scene19Journey";
import { Scene20CTA } from "../scenes/Scene20CTA";

const sceneComponents: React.FC[] = [
  Scene01Intro,
  Scene02Problem,
  Scene03LeadsLost,
  Scene04Bottleneck,
  Scene05Connects,
  Scene06Application,
  Scene07Profile,
  Scene08Scoring,
  Scene09Response,
  Scene10Booking,
  Scene11Pipeline,
  Scene12Workflow,
  Scene13Compliance,
  Scene14Tasks,
  Scene15Clients,
  Scene16Matching,
  Scene17Dashboard,
  Scene18Transformation,
  Scene19Journey,
  Scene20CTA,
];

/** Maps a scene's declared transition kind to a WebGL-free, DOM-based presentation. */
const presentationFor = (kind: TransitionKind): TransitionPresentation<any> => {
  switch (kind) {
    case "slide-left":
      return slide({ direction: "from-right" });
    case "slide-up":
      return slide({ direction: "from-bottom" });
    case "wipe":
      return wipe({ direction: "from-left" });
    case "zoom":
    case "fade":
    default:
      return fade();
  }
};

/**
 * The single 20-scene Evantix film. Both the portrait and landscape
 * compositions render this exact component — every scene reads the
 * current composition's dimensions itself and adapts, so the story,
 * copy and timing never diverge between aspect ratios.
 *
 * Each scene's Sequence duration comes from AUDIO_TIMELINE (audio-timeline.ts),
 * not directly from timeline.ts's visual-only `seconds` — a scene is held
 * open longer than its original visual length whenever its narration needs
 * more time, and never shortened below it. EvantixAudio (narration, music,
 * SFX) is mounted once here, so it's automatically present in both
 * compositions without being added twice.
 */
export const EvantixFilm: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <TransitionSeries>
        {SCENES.map((scene, i) => {
          const SceneComponent = sceneComponents[i];
          const isFirst = i === 0;
          const timing = AUDIO_TIMELINE[i];
          return (
            <React.Fragment key={scene.id}>
              {!isFirst && (
                <TransitionSeries.Transition
                  presentation={presentationFor(scene.transition)}
                  timing={linearTiming({ durationInFrames: transitionFrames })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={timing.finalFrames}>
                <SceneComponent />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      <EvantixAudio />
    </AbsoluteFill>
  );
};
