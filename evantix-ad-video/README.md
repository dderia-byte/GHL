# Evantix — "Recruit. Automate. Grow." Ad

A 20-scene, fully animated Remotion product film for Evantix Group, built for LinkedIn in
both portrait and landscape, now with a full narration + music + SFX audio system. The whole
story — copy, colors, timing, and audio — lives in a small set of config files, so you can
retime or reword the film without touching scene code.

> **Audio disclosure:** the narration in this video was generated using an artificial
> intelligence voice (OpenAI text-to-speech). The background music and sound effects are
> original, programmatically synthesized audio (ffmpeg), not licensed or sampled from any
> existing recording.

## What's in here

- **20 connected scenes**, 30fps, with cinematic transitions (fade, slide, wipe) — visuals,
  branding, and UI designs are unchanged from the silent cut.
- **Two compositions from one timeline**: `EvantixLandscape` (1920×1080) and `EvantixPortrait`
  (1080×1350) render the exact same story with the exact same audio timing — every scene reads
  its own composition size and adapts layout/scale itself, so the two never drift out of sync.
- **Narrated**: British-English male narration (OpenAI `gpt-4o-mini-tts`, voice `cedar`),
  one clip per scene, each scene held open exactly as long as its narration needs.
  **Every scene is now longer than in the silent cut** — see "Why the film got longer" below.
- **Scored**: an original ambient instrumental (D major → B minor → G major → A major),
  synthesized entirely with ffmpeg, that ducks smoothly under narration and swells back up
  between sections.
- **Subtle SFX**: soft whoosh, click, notification, success chime, and digital tick — also
  synthesized, placed at specific interaction beats (form submit, score reveal, CTA click, etc).

## Quick start

```bash
npm install
npm run preview     # opens Remotion Studio to scrub/preview both compositions
```

### Rendering

```bash
npm run render:landscape   # -> out/evantix-linkedin-landscape.mp4  (1920x1080)
npm run render:portrait    # -> out/evantix-linkedin-portrait.mp4   (1080x1350)
npm run render:all         # both, one after another
```

Both use H.264 video + AAC audio, suitable for direct upload to LinkedIn.

### Troubleshooting: browser/ffmpeg download blocked

Remotion normally downloads its own headless Chrome build on first render. If your network
blocks that, point it at any Chromium/Chrome-headless-shell binary you already have via an
env var (already wired up in `remotion.config.ts`):

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell
npm run render:landscape
```

MP4 export also needs a system `ffmpeg` with an H.264 encoder (`libx264`). Check with
`ffmpeg -encoders | grep 264` — if it's missing, install a full ffmpeg build
(`apt-get install ffmpeg` on Debian/Ubuntu pulls one in with `libx264`).

## Audio pipeline

### 1. Set up your OpenAI API key

Create `.env` in the project root (already gitignored, never commit it):

```
OPENAI_API_KEY=sk-...
```

### 2. Generate everything

```bash
npm run generate:voiceover          # 20 narration MP3s (skips files that already exist)
npm run generate:voiceover:force    # regenerate every narration file, even if present
npm run generate:audio-manifest     # reads real MP3 durations -> src/generated/audio-manifest.ts
npm run generate:music              # original instrumental, sized to the synced film length
npm run generate:sfx                # 5 short interface sound effects
npm run generate:audio              # runs all four, in the right order
```

**Order matters**: regenerate the manifest *after* the voiceover so scene timing reflects real
narration lengths, and regenerate the music *after* the manifest so its length matches the
final (narration-synced) composition duration.

### If this environment has no OpenAI access

`public/assets/voiceover/scene-01.mp3` … `scene-20.mp3` currently contain **silent
placeholders** (`scripts/generate-silent-placeholders.mjs`), sized to word-count-estimated
narration durations, so the film times, transitions, music, and SFX all render correctly today
— you'll just hear silence where narration goes. Once you have API access, run:

```bash
npm run generate:voiceover:force    # --force is required: real files are skipped otherwise,
                                     # since a placeholder already "exists" at that path
npm run generate:audio-manifest     # switches every scene from estimated -> measured duration
npm run generate:music              # re-cut to the (likely slightly different) real length
npm run render:all
```

Each manifest entry is tagged `"source": "measured"` or `"estimated"` — check
`src/generated/audio-manifest.ts` to see which scenes are still placeholders.

## Why the film got longer

The original silent cut ran ~61 seconds, paced for fast scene changes with no narration. The
narration script (20 sentences, ~260 words total) needs roughly 100–110 seconds to speak at a
natural, unhurried pace — and the sync rule is **never cut off speech, never shorten a scene
below its narration length**. So most scenes now hold a few seconds longer than the original
silent timing to let their sentence land properly; nothing was shortened. With real narration
generated, expect a final render in the neighbourhood of *100–120 seconds* — noticeably longer
than the original 61s cut. If you want the fast-paced feel back, the two easiest levers are
trimming the narration script to fewer/shorter sentences per scene, or accepting narration that
talks over part of the *next* scene's visuals (not implemented — the current build keeps audio
and visuals for each scene strictly together).

## Editing the film

Everything you're likely to want to change lives in **`src/config/`**:

| File | Controls |
|---|---|
| `src/config/brand.ts` | Company name, tagline, positioning, website, CTA text, the full color palette, and the demo data (candidate name, metrics, client details) used across scenes. |
| `src/config/timeline.json` | Every scene's *visual* length (`seconds`) and its entrance transition. This is the minimum time a scene gets — `audio-timeline.ts` extends it if narration needs more. |
| `src/config/audio-timeline.ts` | Derives each scene's *actual* rendered duration (visual minimum vs. narration requirement) and every scene's global start/end frame. Change `VOICEOVER_DELAY_FRAMES`, `CLOSING_PAUSE_FRAMES`, or `FINAL_CTA_HOLD_FRAMES` here. |
| `src/config/sound-effects.ts` | Which SFX plays, at what offset from each scene's start, and at what volume. |
| `src/content/voiceover-script.json` | The actual narration text per scene — edit this, then re-run the generate:audio pipeline. |
| `src/config/fonts.ts` | The display typeface (Inter, loaded via `@remotion/google-fonts` so it renders identically in preview and on render). |

To reword a scene's on-screen copy or restyle a specific piece of UI, open its file in
`src/scenes/Scene01Intro.tsx` … `Scene20CTA.tsx`. Each scene composes from the shared
component library in `src/components/` (`CRMWindow`, `CandidateCard`, `Pipeline`,
`WorkflowBuilder`, `MetricCard`, `Notification`, `ScoreGauge`, `Chart`, `AnimatedText`,
`Cursor`, `Logo`) — reuse those rather than hand-rolling new UI where you can.

### Swapping the logo

Replace `public/assets/evantix-logo.png` with any same-aspect-ratio PNG — `Logo.tsx` picks it
up automatically. Nothing in the codebase recolors or redraws it.

## Project structure

```
src/
  Root.tsx                       registers both compositions (duration from audio-timeline.ts)
  index.ts                       Remotion entry point
  compositions/
    EvantixFilm.tsx              shared TransitionSeries timeline + mounts EvantixAudio once
    EvantixLandscape.tsx         1920x1080 wrapper around EvantixFilm
    EvantixPortrait.tsx          1080x1350 wrapper around EvantixFilm
  scenes/
    Scene01Intro.tsx … Scene20CTA.tsx
  components/                    CRMWindow, CandidateCard, Pipeline, WorkflowBuilder,
                                  MetricCard, Chart, ScoreGauge, Notification, Cursor, Logo...
  audio/
    EvantixAudio.tsx              mounts narration + music + SFX (once, shared by both comps)
    VoiceoverTrack.tsx             20 narration Sequences, positioned per audio-timeline.ts
    BackgroundMusic.tsx            scene-aware base volume + narration ducking
    getDuckedMusicVolume.ts        the reusable ducking curve (pre-roll, hold, recovery)
    SoundEffects.tsx                plays every cue from config/sound-effects.ts
  config/
    brand.ts / timeline.json+ts / audio-timeline.ts / sound-effects.ts / fonts.ts
  content/
    voiceover-script.json+ts       narration text + TTS voice instructions (shared with scripts/)
  generated/
    audio-manifest.ts+json         AUTO-GENERATED real (or estimated) MP3 durations
  utils/animation.ts               shared easing/spring/count-up/draw-on helpers
  styles/global.css
scripts/
  generate-voiceover.mjs           OpenAI TTS -> public/assets/voiceover/scene-XX.mp3
  generate-audio-manifest.mjs      reads real MP3 durations via music-metadata
  generate-background-music.mjs   ffmpeg-synthesized instrumental, sized to film length
  generate-sound-effects.mjs      ffmpeg-synthesized SFX set
  generate-silent-placeholders.mjs  silent stand-ins so the pipeline renders with no API access
  lib/audio-timeline-calc.mjs     plain-Node mirror of audio-timeline.ts's sync formula
public/assets/
  evantix-logo.png                 the real logo
  evantix-background-music.mp3     generated instrumental
  voiceover/scene-01.mp3 … scene-20.mp3   generated (or placeholder) narration
  sfx/*.wav                        generated sound effects
```

## Notes on the build

- Typechecks clean with `npm run build` (`tsc --noEmit`).
- Every scene is responsive: layout, type scale, and component sizing (e.g. the pipeline's
  column width) are computed from the active composition's dimensions rather than hardcoded,
  so portrait and landscape both stay inside safe margins with no cropped or truncated text.
- Motion follows one easing language throughout: `smoothEase` (a cubic-bezier) for
  data/UI motion, low-bounce springs for entrances — no default spinning/bouncy easing.
- Candidate names, metrics, and company details throughout are illustrative demo data,
  labelled as such on the analytics scene.
- `.env` (your `OPENAI_API_KEY`) is gitignored and is never read by any browser-rendered
  React component — only by the Node.js generation scripts in `scripts/`.
