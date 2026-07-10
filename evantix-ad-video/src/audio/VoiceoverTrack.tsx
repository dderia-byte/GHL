import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { AUDIO_TIMELINE } from "../config/audio-timeline";

const FADE_FRAMES = 4; // very short — narration should feel present, not washed in/out

const VoiceoverClip: React.FC<{ file: string; durationFrames: number }> = ({ file, durationFrames }) => {
  const frame = useCurrentFrame();
  const volume = interpolate(
    frame,
    [0, FADE_FRAMES, Math.max(FADE_FRAMES, durationFrames - FADE_FRAMES), durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <Audio src={staticFile(file)} volume={volume} />;
};

/**
 * All 20 narration clips, each placed in its own Sequence starting after its
 * scene's configured voiceover delay, per src/config/audio-timeline.ts. Each
 * plays once, with a very short fade to prevent clicks, at full presence
 * (volume ~1) so it always reads clearly over the ducked music bed.
 */
export const VoiceoverTrack: React.FC = () => {
  return (
    <>
      {AUDIO_TIMELINE.map((scene) => (
        <Sequence key={scene.id} from={scene.voiceoverStartFrame} durationInFrames={scene.durationFrames} layout="none">
          <VoiceoverClip file={scene.audioFile} durationFrames={scene.durationFrames} />
        </Sequence>
      ))}
    </>
  );
};
