import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { SFX_FILES, SOUND_EFFECT_CUES } from "../config/sound-effects";

/** Every subtle SFX cue, placed at its resolved absolute frame. */
export const SoundEffects: React.FC = () => {
  return (
    <>
      {SOUND_EFFECT_CUES.map((cue, i) => (
        <Sequence key={`${cue.effect}-${i}`} from={cue.atFrame} layout="none">
          <Audio src={staticFile(SFX_FILES[cue.effect])} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};
