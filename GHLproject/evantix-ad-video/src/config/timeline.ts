/**
 * Central timing configuration for the 20-scene Evantix journey.
 *
 * The actual scene list/durations live in timeline.json so this data is
 * readable by both TypeScript (Remotion side) and plain Node.js generation
 * scripts (scripts/generate-background-music.mjs, generate-sound-effects.mjs)
 * without duplicating it in two places. Edit the JSON to retime a scene or
 * restyle its transition — nothing else needs to change.
 *
 * Note: scenes are stitched with @remotion/transitions' TransitionSeries, where
 * each transition overlaps the tail of one scene with the head of the next —
 * so the film's real runtime is the sum of scene lengths *minus* the total
 * transition overlap. `finalDurationFrames` below already accounts for that.
 * src/config/audio-timeline.ts derives the *actual* per-scene durations used
 * at render time (extended to fit narration where needed) from this file.
 */
import timelineData from "./timeline.json";

export const FPS: number = timelineData.fps;

export type TransitionKind = "fade" | "slide-left" | "slide-up" | "wipe" | "zoom";

export interface SceneTiming {
  id: string;
  title: string;
  seconds: number;
  /** Transition used to enter this scene from the previous one. */
  transition: TransitionKind;
}

export const TRANSITION_SECONDS: number = timelineData.transitionSeconds;

export const SCENES: SceneTiming[] = timelineData.scenes as SceneTiming[];

export const sceneFrames = (seconds: number) => Math.round(seconds * FPS);
export const transitionFrames = Math.round(TRANSITION_SECONDS * FPS);

/** Naive sum of every scene's own length, ignoring transition overlap. */
export const totalSeconds = SCENES.reduce((sum, s) => sum + s.seconds, 0);
export const totalFrames = Math.round(totalSeconds * FPS);

/** The film's true rendered length once transition overlaps are subtracted. Use this for Composition durationInFrames. */
export const finalDurationFrames = totalFrames - (SCENES.length - 1) * transitionFrames;
export const finalDurationSeconds = finalDurationFrames / FPS;
