import React from "react";
import { VoiceoverTrack } from "./VoiceoverTrack";
import { BackgroundMusic } from "./BackgroundMusic";
import { SoundEffects } from "./SoundEffects";

/**
 * The complete audio composition for the film: narration, background music
 * (with scene-aware levels and automatic ducking under speech), and subtle
 * interface sound effects. Mount this exactly once in the shared composition
 * (EvantixFilm) — both portrait and landscape render that same component, so
 * adding it there covers both without duplicating the audio graph.
 *
 * Music volume automation, ducking, and the opening/closing fades are all
 * handled inside BackgroundMusic — nothing extra is needed here.
 */
export const EvantixAudio: React.FC = () => {
  return (
    <>
      <BackgroundMusic />
      <VoiceoverTrack />
      <SoundEffects />
    </>
  );
};
