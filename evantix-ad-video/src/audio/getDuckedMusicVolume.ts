import { interpolate } from "remotion";

export interface SpeechWindow {
  startFrame: number;
  endFrame: number;
}

export interface DuckingOptions {
  frame: number;
  baseVolume: number;
  duckedVolume: number;
  fadeFrames: number;
  speechWindows: SpeechWindow[];
  /** Frames before narration starts that ducking should begin lowering (spec: ~8). */
  preRollFrames?: number;
  /** Frames after narration ends before music recovers to baseVolume (spec: ~10-15). */
  recoveryFrames?: number;
}

/**
 * Returns the music volume at `frame`, smoothly ducked under every speech
 * window (with a short pre-roll before narration starts and a slightly
 * longer recovery after it ends), and smoothly restored to `baseVolume`
 * between narration sections. Never jumps — always eases via interpolate.
 */
export const getDuckedMusicVolume = ({
  frame,
  baseVolume,
  duckedVolume,
  fadeFrames,
  speechWindows,
  preRollFrames = 8,
  recoveryFrames = 13,
}: DuckingOptions): number => {
  let target = baseVolume;

  for (const window of speechWindows) {
    const duckStart = window.startFrame - preRollFrames;
    const duckedFrom = duckStart - fadeFrames;
    const recoverTo = window.endFrame + recoveryFrames + fadeFrames;

    if (frame < duckedFrom || frame > recoverTo) continue;

    // Ease down into the duck.
    const goingDown = interpolate(frame, [duckedFrom, duckStart], [baseVolume, duckedVolume], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Hold ducked through the speech window + recovery start.
    const holdEnd = window.endFrame + recoveryFrames;
    const held = frame <= holdEnd ? duckedVolume : null;
    // Ease back up after recovery.
    const goingUp = interpolate(frame, [holdEnd, recoverTo], [duckedVolume, baseVolume], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const windowValue = frame < duckStart ? goingDown : held !== null ? held : goingUp;

    // If overlapping windows produce different targets, keep the lower (more ducked) one.
    target = Math.min(target, windowValue);
  }

  return target;
};
