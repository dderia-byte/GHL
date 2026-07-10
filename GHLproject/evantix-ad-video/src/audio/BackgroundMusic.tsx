import React from "react";
import { Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { AUDIO_TIMELINE, SPEECH_WINDOWS, audioSyncedDurationFrames } from "../config/audio-timeline";
import { getDuckedMusicVolume } from "./getDuckedMusicVolume";

const MUSIC_FILE = "assets/evantix-background-music.mp3";

const RAMP_FRAMES = 30;
const FINAL_FADE_FRAMES = 90; // ~3s

/**
 * The base (un-ducked) music level at `frame`, before narration ducking is
 * applied — implements the spec's suggested mix:
 *   opening (before first narration): 0.13
 *   general "between narration" sections: 0.09 (within the 0.08-0.10 range)
 *   scenes 17-19: 0.10
 *   scene 20 CTA: 0.08 (within the 0.07-0.09 range)
 *   final fade-out: 0
 */
const baseMusicVolume = (frame: number): number => {
  const scene1VoiceStart = AUDIO_TIMELINE[0].voiceoverStartFrame;
  const scene17Start = AUDIO_TIMELINE[16].startFrame;
  const scene20Start = AUDIO_TIMELINE[19].startFrame;
  const fadeOutStart = audioSyncedDurationFrames - FINAL_FADE_FRAMES;

  // Reach the "opening" level either at a normal ramp pace, or sooner if
  // scene 1's narration starts before a full ramp would finish (ducking
  // takes over from there — this just avoids an artificial late spike).
  const openingPeakFrame = Math.min(RAMP_FRAMES, scene1VoiceStart);
  const settleFrame = openingPeakFrame + 20;

  const points = [0, openingPeakFrame, settleFrame, scene17Start, scene17Start + RAMP_FRAMES, scene20Start, scene20Start + RAMP_FRAMES, fadeOutStart, audioSyncedDurationFrames];
  const values = [0, 0.13, 0.09, 0.09, 0.1, 0.1, 0.08, 0.08, 0];

  // interpolate() requires strictly increasing breakpoints — dedupe/guard against
  // scenes being short enough that ramp windows collide.
  const cleanPoints: number[] = [];
  const cleanValues: number[] = [];
  points.forEach((p, i) => {
    if (cleanPoints.length === 0 || p > cleanPoints[cleanPoints.length - 1]) {
      cleanPoints.push(p);
      cleanValues.push(values[i]);
    }
  });

  return interpolate(frame, cleanPoints, cleanValues, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Full-length instrumental bed with scene-aware base levels and narration ducking. */
export const BackgroundMusic: React.FC = () => {
  const frame = useCurrentFrame();

  const base = baseMusicVolume(frame);
  const volume = getDuckedMusicVolume({
    frame,
    baseVolume: base,
    duckedVolume: Math.min(base, 0.055),
    fadeFrames: 12,
    speechWindows: SPEECH_WINDOWS,
    preRollFrames: 8,
    recoveryFrames: 13,
  });

  return <Audio src={staticFile(MUSIC_FILE)} volume={volume} />;
};
