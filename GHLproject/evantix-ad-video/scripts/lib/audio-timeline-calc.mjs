/**
 * Plain-Node mirror of src/config/audio-timeline.ts's scene-sync formula, used
 * by the music/SFX generation scripts (which can't import a .ts module
 * directly). Both read the same JSON sources (timeline.json, audio-manifest.json)
 * so the only thing duplicated is the small formula itself — if you change the
 * delay/pause constants or the extension rule, update both places.
 */
import { readFileSync } from "fs";
import path from "path";

export const VOICEOVER_DELAY_FRAMES = 10;
export const CLOSING_PAUSE_FRAMES = 14;

export function computeAudioTimeline(root) {
  const timeline = JSON.parse(readFileSync(path.join(root, "src/config/timeline.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(path.join(root, "src/generated/audio-manifest.json"), "utf8"));

  const fps = timeline.fps;
  const transitionFrames = Math.round(timeline.transitionSeconds * fps);
  const finalCtaHoldFrames = Math.round(1.5 * fps);

  const scenes = [];
  let cursor = 0;

  timeline.scenes.forEach((scene, index) => {
    const sceneNumber = index + 1;
    const entry = manifest[String(sceneNumber)];
    const pauseFrames = sceneNumber === timeline.scenes.length ? finalCtaHoldFrames : CLOSING_PAUSE_FRAMES;
    const durationFrames = Math.round(entry.durationSeconds * fps);
    const visualFrames = Math.round(scene.seconds * fps);
    const requiredFrames = VOICEOVER_DELAY_FRAMES + durationFrames + pauseFrames;
    const finalFrames = Math.max(visualFrames, requiredFrames);

    const startFrame = index === 0 ? 0 : cursor - transitionFrames;
    const endFrame = startFrame + finalFrames;
    const voiceoverStartFrame = startFrame + VOICEOVER_DELAY_FRAMES;
    const voiceoverEndFrame = voiceoverStartFrame + durationFrames;

    scenes.push({
      scene: sceneNumber,
      id: scene.id,
      startFrame,
      endFrame,
      finalFrames,
      voiceoverStartFrame,
      voiceoverEndFrame,
    });

    cursor = endFrame;
  });

  return {
    fps,
    transitionFrames,
    totalFrames: cursor,
    totalSeconds: cursor / fps,
    scenes,
  };
}
