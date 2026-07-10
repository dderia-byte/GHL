#!/usr/bin/env node
/**
 * Synthesizes five short, subtle UI sound effects with ffmpeg (sine tones and
 * filtered noise only — no samples). Each is short, quiet, and clean; volume
 * is finished in Remotion (see src/config/sound-effects.ts), so these are
 * rendered at a moderate, non-clipping level and shaped rather than mixed hot.
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "sfx");
const SAMPLE_RATE = 48000;

function sh(cmd) {
  execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] });
}

mkdirSync(OUT_DIR, { recursive: true });

const effects = [
  {
    // A short filtered-noise sweep — soft, airy whoosh.
    file: "soft-whoosh.wav",
    build: (out) =>
      sh(
        `ffmpeg -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.4:duration=0.55:sample_rate=${SAMPLE_RATE}" ` +
          `-af "bandpass=f=1200:width_type=o:w=1.5,volume=0.5,afade=t=in:d=0.08,afade=t=out:st=0.35:d=0.2" ` +
          `-ar ${SAMPLE_RATE} -ac 2 "${out}"`
      ),
  },
  {
    // A single soft percussive tick.
    file: "click.wav",
    build: (out) =>
      sh(
        `ffmpeg -y -f lavfi -i "sine=frequency=950:duration=0.07:sample_rate=${SAMPLE_RATE}" ` +
          `-af "volume=0.5,afade=t=in:d=0.004,afade=t=out:st=0.02:d=0.05,lowpass=f=4000" ` +
          `-ar ${SAMPLE_RATE} -ac 2 "${out}"`
      ),
  },
  {
    // Two-tone gentle "ding" (rising fifth).
    file: "notification.wav",
    build: (out) => {
      sh(
        `ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.12:sample_rate=${SAMPLE_RATE}" ` +
          `-af "volume=0.4,afade=t=in:d=0.01,afade=t=out:st=0.08:d=0.04" -ar ${SAMPLE_RATE} -ac 1 "${out}.tone1.wav"`
      );
      sh(
        `ffmpeg -y -f lavfi -i "sine=frequency=1318.5:duration=0.16:sample_rate=${SAMPLE_RATE}" ` +
          `-af "volume=0.35,afade=t=in:d=0.01,afade=t=out:st=0.1:d=0.06" -ar ${SAMPLE_RATE} -ac 1 "${out}.tone2.wav"`
      );
      sh(
        `ffmpeg -y -i "${out}.tone1.wav" -i "${out}.tone2.wav" -filter_complex ` +
          `"[1:a]adelay=90|90[t2];[0:a][t2]amix=inputs=2:duration=longest:normalize=0" ` +
          `-ar ${SAMPLE_RATE} -ac 2 "${out}"`
      );
    },
  },
  {
    // Bright three-note ascending arpeggio — success/positive confirmation.
    file: "success.wav",
    build: (out) => {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        sh(
          `ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=0.14:sample_rate=${SAMPLE_RATE}" ` +
            `-af "volume=0.32,afade=t=in:d=0.008,afade=t=out:st=0.08:d=0.06" -ar ${SAMPLE_RATE} -ac 1 "${out}.n${i}.wav"`
        );
      });
      sh(
        `ffmpeg -y -i "${out}.n0.wav" -i "${out}.n1.wav" -i "${out}.n2.wav" -filter_complex ` +
          `"[1:a]adelay=70|70[n1];[2:a]adelay=140|140[n2];[0:a][n1][n2]amix=inputs=3:duration=longest:normalize=0" ` +
          `-ar ${SAMPLE_RATE} -ac 2 "${out}"`
      );
    },
  },
  {
    // Very short, high, subtle blip — for micro data-driven ticks.
    file: "digital-tick.wav",
    build: (out) =>
      sh(
        `ffmpeg -y -f lavfi -i "sine=frequency=1900:duration=0.035:sample_rate=${SAMPLE_RATE}" ` +
          `-af "volume=0.4,afade=t=in:d=0.003,afade=t=out:st=0.015:d=0.02,highpass=f=600" ` +
          `-ar ${SAMPLE_RATE} -ac 2 "${out}"`
      ),
  },
];

function cleanupTemp(outPath) {
  const dir = path.dirname(outPath);
  const base = path.basename(outPath);
  try {
    execSync(`rm -f "${dir}/${base}".n*.wav "${dir}/${base}".tone*.wav`);
  } catch {
    // no temp files to clean
  }
}

let allOk = true;
for (const effect of effects) {
  const outPath = path.join(OUT_DIR, effect.file);
  try {
    effect.build(outPath);
    cleanupTemp(outPath);
    if (!existsSync(outPath)) throw new Error("file was not created");
    console.log(`Saved ${path.relative(ROOT, outPath)}`);
  } catch (error) {
    allOk = false;
    console.error(`Failed to generate ${effect.file}: ${error.message}`);
  }
}

if (!allOk) process.exit(1);
console.log("\nAll sound effects generated.");
