/**
 * The 20-segment narration script, one entry per scene.
 *
 * The actual text/instructions live in voiceover-script.json so this data can
 * be read by both TypeScript (Remotion side) and plain Node.js
 * (scripts/generate-voiceover.mjs) without duplicating the script in two
 * places. Edit the JSON file to change narration wording.
 */
import scriptData from "./voiceover-script.json";

export type VoiceoverSegment = {
  scene: number;
  id: string;
  text: string;
  fileName: string;
};

export const voiceoverSegments: VoiceoverSegment[] = scriptData.segments;

export const VOICE_INSTRUCTIONS: string = scriptData.voiceInstructions;
