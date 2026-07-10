/**
 * Subtle SFX cue placements. Each cue is anchored to a scene and an offset
 * (in frames) *from that scene's own start* — not a hardcoded global frame —
 * so cues stay correctly placed even as audio-timeline.ts extends scene
 * durations to fit narration.
 */
import { AUDIO_TIMELINE } from "./audio-timeline";

export type SfxName = "soft-whoosh" | "click" | "notification" | "success" | "digital-tick";

export const SFX_FILES: Record<SfxName, string> = {
  "soft-whoosh": "assets/sfx/soft-whoosh.wav",
  click: "assets/sfx/click.wav",
  notification: "assets/sfx/notification.wav",
  success: "assets/sfx/success.wav",
  "digital-tick": "assets/sfx/digital-tick.wav",
};

export interface SfxCue {
  scene: number;
  offsetFrames: number;
  effect: SfxName;
  volume: number;
  label: string;
}

/** Recommended effect volume range per spec: 0.06–0.16. */
const CUES: SfxCue[] = [
  { scene: 1, offsetFrames: 0, effect: "soft-whoosh", volume: 0.14, label: "Logo reveal" },
  { scene: 3, offsetFrames: 34, effect: "notification", volume: 0.09, label: "Lead notification" },
  { scene: 5, offsetFrames: 0, effect: "soft-whoosh", volume: 0.13, label: "System connects" },
  { scene: 6, offsetFrames: 48, effect: "click", volume: 0.11, label: "Form submitted" },
  { scene: 8, offsetFrames: 56, effect: "success", volume: 0.12, label: "Scoring complete" },
  { scene: 9, offsetFrames: 20, effect: "notification", volume: 0.1, label: "Email + SMS sent" },
  { scene: 10, offsetFrames: 44, effect: "click", volume: 0.1, label: "Interview booked" },
  { scene: 11, offsetFrames: 40, effect: "soft-whoosh", volume: 0.07, label: "Pipeline card moves" },
  { scene: 12, offsetFrames: 22, effect: "digital-tick", volume: 0.08, label: "Workflow node" },
  { scene: 12, offsetFrames: 44, effect: "digital-tick", volume: 0.08, label: "Workflow node" },
  { scene: 12, offsetFrames: 66, effect: "digital-tick", volume: 0.08, label: "Workflow node" },
  { scene: 13, offsetFrames: 54, effect: "notification", volume: 0.09, label: "Compliance alert" },
  { scene: 17, offsetFrames: 56, effect: "success", volume: 0.12, label: "Dashboard complete" },
  { scene: 20, offsetFrames: 60, effect: "click", volume: 0.13, label: "CTA click" },
];

export interface ResolvedSfxCue extends SfxCue {
  atFrame: number;
}

/** Cues with their absolute global frame resolved from the current audio timeline. */
export const SOUND_EFFECT_CUES: ResolvedSfxCue[] = CUES.map((cue) => {
  const sceneTiming = AUDIO_TIMELINE[cue.scene - 1];
  return { ...cue, atFrame: sceneTiming.startFrame + cue.offsetFrames };
});
