#!/usr/bin/env node
/**
 * Creates silent MP3 placeholders for any voiceover scene that hasn't been
 * generated yet (e.g. because OpenAI access wasn't available), sized to that
 * scene's estimated narration duration from audio-manifest.json.
 *
 * This lets the full render pipeline (timing, music, SFX, ducking) run
 * end-to-end today with correct pacing, with silent gaps where narration
 * will go. Once real access to the OpenAI API is available, run:
 *   npm run generate:voiceover:force
 * to overwrite every placeholder with real narration (the plain
 * `generate:voiceover` command intentionally skips existing files, so
 * --force is required here).
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "voiceover");
const MANIFEST = path.join(ROOT, "src", "generated", "audio-manifest.json");
const SCRIPT_JSON = path.join(ROOT, "src", "content", "voiceover-script.json");
const REAL_MIN_BYTES = 4000; // a real ~5s speech mp3 is comfortably larger than this

mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const { segments } = JSON.parse(readFileSync(SCRIPT_JSON, "utf8"));

let created = 0;
for (const segment of segments) {
  const entry = manifest[String(segment.scene)];
  const outPath = path.join(OUT_DIR, segment.fileName);

  if (existsSync(outPath) && statSync(outPath).size > REAL_MIN_BYTES) {
    continue; // looks like real narration already, leave it alone
  }

  const duration = entry.durationSeconds;
  execSync(
    `ffmpeg -y -f lavfi -i "anullsrc=r=48000:cl=stereo" -t ${duration} -q:a 9 "${outPath}"`,
    { stdio: "ignore" }
  );
  created++;
  console.log(`Placeholder: scene-${String(segment.scene).padStart(2, "0")}.mp3 (${duration}s, silent)`);
}

console.log(`\nCreated ${created} silent placeholder(s). Run "npm run generate:voiceover:force" once OpenAI API access is available to replace them with real narration.`);
