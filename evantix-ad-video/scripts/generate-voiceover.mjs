#!/usr/bin/env node
/**
 * Generates all 20 narration MP3s using the OpenAI TTS API.
 *
 * Usage:
 *   npm run generate:voiceover          (skips files that already exist)
 *   npm run generate:voiceover:force    (regenerates every file)
 *
 * Reads OPENAI_API_KEY from .env (never printed, never logged).
 */
import "dotenv/config";
import OpenAI from "openai";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "voiceover");
const SCRIPT_JSON = path.join(ROOT, "src", "content", "voiceover-script.json");

const MODEL = "gpt-4o-mini-tts";
const VOICE = "cedar";
const RESPONSE_FORMAT = "mp3";
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_GAP_MS = 700;
const MIN_VALID_BYTES = 256;

const force = process.argv.includes("--force");

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  fail(
    "OPENAI_API_KEY is not set. Create a .env file in the project root containing:\n" +
      "OPENAI_API_KEY=your-key-here"
  );
}

if (!existsSync(SCRIPT_JSON)) {
  fail(`Narration script not found at ${SCRIPT_JSON}`);
}

const { segments, voiceInstructions } = JSON.parse(readFileSync(SCRIPT_JSON, "utf8"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Never include the raw API error object (may echo request headers/key) in output. */
function describeError(error) {
  const status = error?.status ?? error?.response?.status;
  const msg = String(error?.message ?? "");
  if (/host not in allowlist|network egress/i.test(msg)) {
    return {
      category: "Network blocked",
      message: "Outbound access to the OpenAI API is blocked by this environment's network policy (not an API key problem).",
    };
  }
  if (status === 401) {
    return { category: "Authentication", message: "The API key was rejected. Check that it is valid and active." };
  }
  if (status === 403) {
    return { category: "Forbidden", message: "The request was refused. Check API key permissions, or see above if this is a network policy block." };
  }
  if (status === 429) {
    return { category: "Rate limit", message: "Too many requests, or insufficient quota. Will retry with backoff." };
  }
  if (status >= 500) {
    return { category: "OpenAI server error", message: "The API had a temporary issue. Will retry." };
  }
  if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT") {
    return { category: "Network", message: "Could not reach the OpenAI API from this environment." };
  }
  return { category: "Unknown", message: error?.message ? String(error.message).slice(0, 200) : "An unexpected error occurred." };
}

async function generateOne(segment) {
  const outPath = path.join(OUT_DIR, segment.fileName);

  if (!force && existsSync(outPath)) {
    const { size } = statSync(outPath);
    if (size >= MIN_VALID_BYTES) {
      console.log(`Skipping scene ${String(segment.scene).padStart(2, "0")} of ${segments.length} (already exists).`);
      return { ok: true, skipped: true };
    }
  }

  console.log(`Generating scene ${String(segment.scene).padStart(2, "0")} of ${segments.length}...`);

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: MODEL,
        voice: VOICE,
        input: segment.text,
        instructions: voiceInstructions,
        response_format: RESPONSE_FORMAT,
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.byteLength < MIN_VALID_BYTES) {
        throw new Error(`Returned audio was empty or too small (${buffer.byteLength} bytes).`);
      }

      writeFileSync(outPath, buffer);
      console.log(`Saved ${segment.fileName} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
      return { ok: true, skipped: false };
    } catch (error) {
      const { category, message } = describeError(error);
      console.error(`  Scene ${String(segment.scene).padStart(2, "0")} — ${category}: ${message}`);

      const status = error?.status ?? error?.response?.status;
      const retriable = status === undefined || status === 429 || status >= 500;
      if (!retriable || attempt === RETRY_ATTEMPTS) {
        return { ok: false, skipped: false };
      }
      console.error(`  Retrying (${attempt}/${RETRY_ATTEMPTS - 1})...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return { ok: false, skipped: false };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating voiceover for ${segments.length} scenes using ${MODEL} (voice: ${VOICE})${force ? " [force]" : ""}...\n`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const segment of segments) {
    const result = await generateOne(segment);
    if (result.ok && result.skipped) skipped++;
    else if (result.ok) succeeded++;
    else failed++;

    await sleep(REQUEST_GAP_MS);
  }

  console.log(`\nDone. Generated: ${succeeded}, skipped (already existed): ${skipped}, failed: ${failed}.`);

  if (failed > 0) {
    console.error("Some scenes failed to generate. Re-run this command to retry only the missing files.");
    process.exit(1);
  }
}

main();
