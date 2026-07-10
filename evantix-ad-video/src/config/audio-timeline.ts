/**
 * Synchronises every scene's on-screen duration to its narration.
 *
 * This is a *derived* layer on top of src/config/timeline.ts (the visual
 * source of truth) and src/generated/audio-manifest.ts (real — or, until
 * voiceover files exist, estimated — narration durations). Nothing here
 * duplicates that data; it only combines the two.
 *
 * Rule applied per scene, per spec:
 *   requiredFrames = voiceoverDelayFrames + narrationFrames + pauseFrames
 *   finalFrames    = max(existing visual duration, requiredFrames)
 * i.e. a scene is never shortened for narration — only ever held open longer
 * if the voiceover needs more time than the visuals were already given.
 */
import { FPS, SCENES, sceneFrames, transitionFrames } from "./timeline";
import { voiceoverSegments } from "../content/voiceover-script";
import { generatedAudioManifest } from "../generated/audio-manifest";

/** Frames between a scene starting and its narration beginning (spec range: 8-12). */
export const VOICEOVER_DELAY_FRAMES = 10;

/** Frames held after narration ends before the scene may transition out (spec range: 8-18). */
export const CLOSING_PAUSE_FRAMES = 14;

/** Scene 20 holds on the CTA ~1.5s after narration finishes, per spec Step 16. */
export const FINAL_CTA_HOLD_FRAMES = Math.round(1.5 * FPS);

export interface AudioSceneTiming {
  scene: number;
  id: string;
  audioFile: string;
  audioSource: "measured" | "estimated";
  durationSeconds: number;
  durationFrames: number;
  voiceoverDelayFrames: number;
  pauseFrames: number;
  /** The scene's original visual-only length, from timeline.ts. */
  visualFrames: number;
  /** max(visualFrames, delay + narration + pause) — what the scene actually renders for. */
  finalFrames: number;
  finalSeconds: number;
  /** Global frame (within the whole composition) this scene's Sequence starts at. */
  startFrame: number;
  /** Global frame this scene's Sequence ends at. */
  endFrame: number;
  /** Global frame the narration Audio begins playing at. */
  voiceoverStartFrame: number;
  /** Global frame the narration Audio finishes at. */
  voiceoverEndFrame: number;
}

function buildAudioTimeline(): AudioSceneTiming[] {
  const timings: AudioSceneTiming[] = [];
  let cursor = 0;

  SCENES.forEach((scene, index) => {
    const sceneNumber = index + 1;
    const segment = voiceoverSegments[index];
    const manifestEntry = generatedAudioManifest[sceneNumber];

    if (!segment || !manifestEntry) {
      throw new Error(`Missing voiceover script or audio manifest entry for scene ${sceneNumber}`);
    }

    const pauseFrames = sceneNumber === SCENES.length ? FINAL_CTA_HOLD_FRAMES : CLOSING_PAUSE_FRAMES;
    const durationFrames = Math.round(manifestEntry.durationSeconds * FPS);
    const visualFrames = sceneFrames(scene.seconds);
    const requiredFrames = VOICEOVER_DELAY_FRAMES + durationFrames + pauseFrames;
    const finalFrames = Math.max(visualFrames, requiredFrames);

    const startFrame = index === 0 ? 0 : cursor - transitionFrames;
    const endFrame = startFrame + finalFrames;
    const voiceoverStartFrame = startFrame + VOICEOVER_DELAY_FRAMES;
    const voiceoverEndFrame = voiceoverStartFrame + durationFrames;

    timings.push({
      scene: sceneNumber,
      id: scene.id,
      audioFile: manifestEntry.file,
      audioSource: manifestEntry.source,
      durationSeconds: manifestEntry.durationSeconds,
      durationFrames,
      voiceoverDelayFrames: VOICEOVER_DELAY_FRAMES,
      pauseFrames,
      visualFrames,
      finalFrames,
      finalSeconds: finalFrames / FPS,
      startFrame,
      endFrame,
      voiceoverStartFrame,
      voiceoverEndFrame,
    });

    cursor = endFrame;
  });

  return timings;
}

export const AUDIO_TIMELINE: AudioSceneTiming[] = buildAudioTimeline();

/** The film's true rendered length, accounting for both audio-driven extensions and transition overlap. */
export const audioSyncedDurationFrames: number =
  AUDIO_TIMELINE[AUDIO_TIMELINE.length - 1].endFrame;
export const audioSyncedDurationSeconds: number = audioSyncedDurationFrames / FPS;

/** Every narration's [start, end) window — used by music ducking. */
export const SPEECH_WINDOWS: { startFrame: number; endFrame: number }[] = AUDIO_TIMELINE.map((t) => ({
  startFrame: t.voiceoverStartFrame,
  endFrame: t.voiceoverEndFrame,
}));

/** True only once every scene's narration was measured from a real generated MP3 (not estimated). */
export const allDurationsMeasured: boolean = AUDIO_TIMELINE.every((t) => t.audioSource === "measured");
