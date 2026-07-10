#!/usr/bin/env node
/**
 * Synthesizes an original, subtle instrumental bed for the film using ffmpeg
 * audio synthesis only (sine tones + filtered noise) — no samples, no loops
 * from any external source. Sized automatically to the film's actual
 * (narration-synced) duration.
 *
 * Chord progression: D major -> B minor -> G major -> A major, sustained,
 * with a gentle amplitude pulse, soft high-frequency air texture, and a
 * touch of chorus/haas stereo width. No drums, no melody, no vocals.
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { computeAudioTimeline } from "./lib/audio-timeline-calc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "public", "assets", "evantix-background-music.mp3");

const SAMPLE_RATE = 48000;
const CHORD_SECONDS = 6;
const CHORD_FADE = 0.9;

// Each chord: [bassHz, padHz, padHz, padHz]
const CHORDS = [
  { name: "D-major", notes: [73.42, 146.83, 185.0, 220.0] }, // D2, D3, F#3, A3
  { name: "B-minor", notes: [123.47, 246.94, 293.66, 369.99] }, // B2, B3, D4, F#4
  { name: "G-major", notes: [98.0, 196.0, 246.94, 293.66] }, // G2, G3, B3, D4
  { name: "A-major", notes: [110.0, 220.0, 277.18, 329.63] }, // A2, A3, C#4, E4
];
const NOTE_GAINS = [0.5, 0.22, 0.2, 0.18]; // bass louder, pads soft

function sh(cmd) {
  execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] });
}

function buildChordWav(chord, outPath) {
  const inputs = chord.notes
    .map((freq) => `-f lavfi -i "sine=frequency=${freq}:duration=${CHORD_SECONDS}:sample_rate=${SAMPLE_RATE}"`)
    .join(" ");
  const volumeStage = chord.notes.map((_, i) => `[${i}:a]volume=${NOTE_GAINS[i]}[v${i}]`).join(";");
  const mixInputs = chord.notes.map((_, i) => `[v${i}]`).join("");
  const filter = `${volumeStage};${mixInputs}amix=inputs=${chord.notes.length}:duration=longest:normalize=0,afade=t=in:d=${CHORD_FADE},afade=t=out:st=${CHORD_SECONDS - CHORD_FADE}:d=${CHORD_FADE}`;

  sh(`ffmpeg -y ${inputs} -filter_complex "${filter}" -ar ${SAMPLE_RATE} -ac 1 "${outPath}"`);
}

function getPeakDb(filePath) {
  // astats prints max_volume-style info via -af volumedetect to stderr.
  const out = execSync(`ffmpeg -i "${filePath}" -af volumedetect -f null - 2>&1`).toString();
  const match = out.match(/max_volume:\s*(-?\d+(\.\d+)?)\s*dB/);
  return match ? parseFloat(match[1]) : null;
}

async function main() {
  const timeline = computeAudioTimeline(ROOT);
  const totalSeconds = Math.ceil(timeline.totalSeconds);
  console.log(`Target music duration: ${totalSeconds}s (matches synced composition length)`);

  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const tmp = mkdtempSync(path.join(tmpdir(), "evantix-music-"));

  try {
    console.log("Synthesizing chord tones (D major -> B minor -> G major -> A major)...");
    const chordPaths = CHORDS.map((chord, i) => path.join(tmp, `chord-${i}.wav`));
    CHORDS.forEach((chord, i) => buildChordWav(chord, chordPaths[i]));

    const cyclesNeeded = Math.ceil(totalSeconds / (CHORDS.length * CHORD_SECONDS)) + 1;
    const listPath = path.join(tmp, "concat-list.txt");
    const listLines = [];
    for (let c = 0; c < cyclesNeeded; c++) {
      for (const p of chordPaths) listLines.push(`file '${p}'`);
    }
    writeFileSync(listPath, listLines.join("\n"));

    console.log(`Looping progression (${cyclesNeeded} cycles) and trimming to length...`);
    const padRaw = path.join(tmp, "pad-raw.wav");
    sh(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -t ${totalSeconds} -ar ${SAMPLE_RATE} -ac 1 "${padRaw}"`);

    console.log("Shaping the pad (gentle pulse, filtering, stereo width)...");
    const padShaped = path.join(tmp, "pad-shaped.wav");
    sh(
      `ffmpeg -y -i "${padRaw}" -af "tremolo=f=0.55:d=0.12,highpass=f=65,lowpass=f=4200,chorus=0.6:0.9:55:0.4:0.25:2,haas" ` +
        `-ar ${SAMPLE_RATE} -ac 2 "${padShaped}"`
    );

    console.log("Adding a soft high-frequency air texture...");
    const texture = path.join(tmp, "texture.wav");
    sh(
      `ffmpeg -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.06:duration=${totalSeconds}:sample_rate=${SAMPLE_RATE}" ` +
        `-af "highpass=f=7000,lowpass=f=13000,volume=0.05,tremolo=f=0.2:d=0.3" -ar ${SAMPLE_RATE} -ac 2 "${texture}"`
    );

    console.log("Mixing, limiting, and applying overall fades...");
    const fadeOutStart = Math.max(0, totalSeconds - 3.5);
    const mixed = path.join(tmp, "mixed.wav");
    sh(
      `ffmpeg -y -i "${padShaped}" -i "${texture}" -filter_complex ` +
        `"[0:a][1:a]amix=inputs=2:duration=shortest:normalize=0,` +
        `afade=t=in:d=2.5,afade=t=out:st=${fadeOutStart}:d=3.5,` +
        `alimiter=limit=0.85:attack=5:release=50" ` +
        `-ar ${SAMPLE_RATE} -ac 2 "${mixed}"`
    );

    let peak = getPeakDb(mixed);
    console.log(`Peak level: ${peak !== null ? peak + " dB" : "unknown"}`);

    let finalSource = mixed;
    if (peak !== null && peak > -1) {
      console.log("Peak too hot — applying extra headroom and re-limiting...");
      const safe = path.join(tmp, "mixed-safe.wav");
      sh(`ffmpeg -y -i "${mixed}" -af "volume=-4dB,alimiter=limit=0.8" -ar ${SAMPLE_RATE} -ac 2 "${safe}"`);
      finalSource = safe;
      peak = getPeakDb(safe);
      console.log(`Peak level after correction: ${peak !== null ? peak + " dB" : "unknown"}`);
    }

    sh(`ffmpeg -y -i "${finalSource}" -ar ${SAMPLE_RATE} -ac 2 -b:a 192k "${OUT_FILE}"`);

    if (!existsSync(OUT_FILE)) {
      throw new Error("Music file was not created.");
    }
    console.log(`\nSaved ${path.relative(ROOT, OUT_FILE)} (${totalSeconds}s, 48kHz stereo MP3, peak ${peak ?? "?"} dB)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Music generation failed:", err.message);
  process.exit(1);
});
