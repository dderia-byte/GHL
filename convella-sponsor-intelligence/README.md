# Convella Sponsor Intelligence

An internal tool for **Convella**, an influencer-marketing agency, that analyses YouTube
videos to identify sponsors, evidence, timestamps, placement types, and confidence
scores — so the team can discover which brands sponsor which creators, when, and how.

> **All demo/seed data in this repository is fictional.** No real creators, brands, or
> sponsorship relationships are represented anywhere in the seed data.

## What this system actually does

For every video, the system:

1. Reads the video title and full YouTube description (via the official YouTube Data API v3).
2. Obtains a timestamped transcript where one is available (pasted, uploaded, or a mock
   provider in development) — see [Transcript providers](#transcript-providers) below.
3. Actively analyses the video **sequentially from the beginning**, in short chunks
   (30s for videos under 10 minutes, 60s otherwise), combining:
   - Audio (spoken sponsorship disclosures, brand names, calls to action)
   - Visuals (logos, on-screen text, URLs, sponsor cards, product interfaces)
   - Transcript context (±15s around the current chunk)
   - The video description (sponsor disclosures, links, discount codes, chapters)
   - Official YouTube metadata (paid-product-placement flag, tags)
4. Stops the moment a sponsor is **confidently recognised** — see
   [The stopping condition](#the-stopping-condition) — by default (`FIRST_SPONSOR_ONLY`).
   An `ALL_SPONSORS` mode is also available per channel/video.
5. Saves every detection with its confidence score, supporting evidence, evidence
   source, timestamp, and a `PENDING` human-review status — **never** as an
   automatically "confirmed" fact.

The system does **not** rely on transcript keyword-matching alone, and it does **not**
download, scrape, or otherwise bypass YouTube's technical controls to obtain video or
audio content. See [Compliance & limitations](#compliance--limitations).

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · PostgreSQL · Prisma 7
(driver adapters) · Zod · Anthropic API · Gemini API · YouTube Data API v3 · Vitest ·
Playwright · Docker Compose (Postgres) · a database-backed background job queue.

## Architecture at a glance

```
src/
  app/                     Next.js App Router pages, server actions, API routes
  components/              Shared UI primitives (badges, cards, buttons, layout)
  lib/
    youtube/                Official YouTube Data API v3 client, URL/handle parsing, caching
    transcript/              TranscriptProvider interface + Manual/UploadedFile/Mock providers
    video-analysis/           VideoAnalysisProvider interface + Gemini/Mock providers
    signals/                  Deterministic description/transcript/metadata signal extraction
    decision/                  The sponsorship decision engine (scoring + strict stop condition)
    anthropic/                 Structured-classification reasoning service (Zod-validated)
    brand/                     Brand normalisation, competitor suggestions, creator opportunities
    jobs/                      Database-backed job queue + the sequential analysis pipeline
    csv/                       CSV export with formula-injection protection
    validation/                Zod schemas for all form/API inputs
  generated/prisma/         Generated Prisma Client (gitignored, regenerate with `prisma generate`)
scripts/worker.ts          Simple polling background worker (see below)
prisma/schema.prisma       Full data model
prisma/seed.ts             Fictional demonstration data
tests/unit, tests/integration, tests/e2e
```

Every external integration (YouTube, transcripts, video analysis, AI reasoning) sits
behind a small interface so providers can be swapped without touching business logic —
see each `lib/*/types.ts` file.

## Getting started

### 1. Prerequisites

- Node.js 20.9+ and npm
- Docker (for local PostgreSQL) — or a local PostgreSQL 16 instance

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` with the credentials already wired into
`.env.example` (`convella` / `convella` / database `convella_sponsor_intelligence`). If
you'd rather use an existing PostgreSQL install, just point `DATABASE_URL` at it.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in the API keys you have available — see [Provider setup](#provider-setup) below.
**Every provider gracefully falls back to a mock implementation when its key is
missing**, so the app is fully usable with zero API keys configured.

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Seed fictional demonstration data (optional but recommended)

```bash
npm run db:seed
```

### 7. Start the app

```bash
npm run dev
```

Visit http://localhost:3000.

### 8. Start the background worker

Analysis jobs are queued by the web app but processed by a separate worker process (see
[Background worker](#background-worker)):

```bash
npm run worker
```

## Provider setup

### YouTube Data API v3

1. Create a Google Cloud project and enable the **YouTube Data API v3**.
2. Create an API key and restrict it to the YouTube Data API.
3. Set `YOUTUBE_API_KEY` in `.env`.

Without this key, adding channels/videos will return a clear "not configured" error —
there is no scraping fallback, by design (see [Compliance](#compliance--limitations)).

The client prefers cheap calls: `channels.list` (by ID/handle/username), the channel's
uploads playlist via `playlistItems.list`, and **batched** `videos.list` calls (up to 50
IDs per request) instead of `search.list`. Responses are cached in-process for 5 minutes
and durably cached as `Channel`/`Video` rows. 403 `quotaExceeded` responses are mapped to
a clear, user-facing message; transient 429/5xx responses are retried with exponential
backoff.

### Anthropic (structured reasoning)

1. Get an API key from the Anthropic Console.
2. Set `ANTHROPIC_API_KEY` and, optionally, `ANTHROPIC_MODEL` (defaults to a current
   Claude model) in `.env`.

Used for: final structured classification of accumulated evidence into a canonical
brand/domain/category/placement type/reasoning summary, and for AI-generated
competitor suggestions. All responses are Zod-validated; a malformed reply triggers one
corrective retry before failing loudly (never silently inventing data). Without a key,
a documented deterministic heuristic fallback is used instead so the pipeline still
functions — see `src/lib/anthropic/reasoning-service.ts`.

### Gemini (multimodal video analysis)

1. Get a Gemini API key (Google AI Studio or Vertex AI).
2. Set `GEMINI_API_KEY` and, optionally, `GEMINI_VIDEO_MODEL` in `.env`.

This is the runtime multimodal provider — it can reason over audio and visual content
in addition to text. It is implemented as a modular `VideoAnalysisProvider`
(`src/lib/video-analysis/providers/gemini.ts`) specifically so other providers (OpenAI,
self-hosted vision/speech models, a future Anthropic multimodal endpoint, etc.) can be
added later without touching the pipeline. Without a key, `MockVideoAnalysisProvider` is
used automatically.

**Important limitation:** this system never downloads YouTube video/audio itself (that
would bypass YouTube's technical controls). Real Gemini calls run against title,
description, and transcript context; genuine audio/visual inspection only happens for
chunks where the pipeline has an **authorised media reference** (e.g. media the
operator uploaded and confirmed they have rights to process). See
[Video-processing limitations](#video-processing-limitations).

## Transcript providers

YouTube's official captions API **cannot be assumed to provide a transcript for an
arbitrary public video** — many videos have no accessible captions track, and this
system does not attempt to scrape or bypass YouTube to obtain one. Instead, transcript
acquisition is a modular `TranscriptProvider` interface
(`src/lib/transcript/types.ts`) with these implementations:

| Provider | Use |
| --- | --- |
| `ManualTranscriptProvider` | User pastes transcript text directly into the video page |
| `UploadedFileTranscriptProvider` | User uploads a `.srt`, `.vtt`, or `.txt` file |
| `MockTranscriptProvider` | Deterministic fixture for local development/testing |
| `AuthorisedTranscriptProvider` | **Unimplemented extension point** for a future licensed/authorised captions source |

Set `TRANSCRIPT_PROVIDER=mock` in development to auto-populate a fixture transcript for
new videos. In all other cases, if no transcript is supplied, the video's
`transcriptStatus` becomes `MANUAL_UPLOAD_REQUIRED` and analysis **continues without
it** — audio/visual analysis and description signals are unaffected, and the absence of
a transcript never fails the job (it only reduces the transcript-source confidence
contribution).

## Media authorisation

You must only process video or audio you have the legal right or permission to
analyse. The "Add channel or video" page includes an explicit acknowledgement checkbox
for this. The `Video.mediaAuthorised` flag records that acknowledgement. This system
does not download YouTube video/audio automatically to satisfy that requirement —
genuine multimodal (audio/visual) inspection is only available for authorised media the
operator has separately supplied.

## The stopping condition

The decision engine (`src/lib/decision/engine.ts` + `scoring.ts`) only stops analysis
when **all** of the following hold:

- `recognised === true` for the current chunk, **and**
- the computed confidence score is **≥ 0.90**, **and**
- at least one **explicit commercial signal** is present (a spoken "sponsored by" /
  "thanks to X for sponsoring" / "brought to you by" statement, an on-screen paid-
  promotion disclosure, matching YouTube paid-promotion metadata, or a promotional
  segment matched to a description link/discount code + call to action), **and**
- the brand identity is **unambiguous** (backed by a matching domain, or an explicit
  statement that names the exact brand).

A bare logo appearance, an ordinary product demonstration, a competitor comparison, or
an organic recommendation never triggers a stop, however many times it recurs.

Confidence is **not** a simple weighted sum: it also applies an agreement bonus across
independent evidence sources, a penalty for contradictory evidence, and a hard cap for
ambiguous brand identities (a bare "Warp" or "Claude" mention is never assumed to be a
sponsor without a matching domain or explicit context — see
`src/lib/brand/normalize.ts`).

## Cost control

- Sequential chunking with early stopping (first-sponsor mode)
- Deterministic description/transcript signal extraction runs **before** any AI call,
  to seed candidate brands and reduce reliance on the model
- A maximum of 120 chunks and 3600 analysed seconds per video (configurable in
  `src/lib/jobs/video-analysis-pipeline.ts`)
- Per-job estimated cost and model usage tracking (`AnalysisJob.estimatedCost`,
  `.modelUsage`) — clearly labelled as an **estimate**, not a billing-accurate figure
- Retry limits (3 attempts) before a job is marked `FAILED`

## Background worker

Analysis is a **database-backed queue** (the `AnalysisJob` table): the web app enqueues
jobs (`QUEUED`), and a separate worker process claims and processes them
(`scripts/worker.ts`). This separation means the (potentially slow, API-calling) chunk
loop never blocks a web request, and a failed video never stops the rest of a channel
scan.

```bash
npm run worker                      # continuous polling loop
WORKER_RUN_ONCE=true npm run worker # process at most one job, then exit
```

This is intentionally a simple polling loop so **Redis/BullMQ (or any other queue) can
be swapped in later** without changing `runVideoAnalysis`, `scanChannelVideos`, or any
other business logic — only `src/lib/jobs/queue.ts`'s claim/enqueue functions would
need to change.

## Testing

```bash
npm test              # Vitest unit + integration tests (mocked YouTube/Gemini/Anthropic/transcript responses)
npm run test:watch    # watch mode
npm run test:e2e      # Playwright end-to-end test
```

The Playwright test (`tests/e2e/sponsor-detection.spec.ts`) spins up a local mock
YouTube API server and a real background worker against a dedicated
`convella_e2e_test` database (create it once: `createdb convella_e2e_test && DATABASE_URL=postgresql://convella:convella@localhost:5432/convella_e2e_test npx prisma migrate deploy`),
then drives the full flow: add a channel → import a video → the worker runs a mocked
analysis → a sponsor is detected and the analysis stops after the first confirmed
sponsor → the detection is reviewed and confirmed → the channel's results are exported
to CSV.

## Production deployment notes

- Run `npm run build && npm run start` for the web app, and run `scripts/worker.ts`
  (via `npm run worker`, under a process manager such as systemd or PM2) as a separate
  long-running process.
- Provide `DATABASE_URL` pointing at a managed PostgreSQL instance and run
  `npx prisma migrate deploy` as part of your deploy pipeline.
- All secrets (`YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are read
  server-side only via `src/lib/env.ts` and are never sent to the client.
- Consider swapping the polling worker for Redis/BullMQ at higher throughput — the
  queue abstraction in `src/lib/jobs/queue.ts` is designed for that swap.

## Compliance & limitations

- **This system never scrapes YouTube, bypasses CAPTCHAs, evades rate limits, or
  downloads copyrighted video/audio without authorisation.** All YouTube metadata comes
  from the official YouTube Data API v3.
- **The YouTube captions API cannot be assumed to provide a transcript for an arbitrary
  public video.** The modular transcript-provider system (manual paste, file upload,
  mock, and a documented-but-unimplemented authorised-provider extension point) exists
  specifically because of this.
- **Only process video or audio you have the legal right or permission to analyse.**
  The "Add channel or video" flow requires an explicit acknowledgement of this.
- **Every AI-assisted sponsor detection requires human review.** Detections carry a
  `reviewStatus` of `PENDING` until a person confirms, rejects, edits, or reclassifies
  them (`ORGANIC`/`EDITED`). Nothing is presented as a confirmed fact by the AI alone.
- **Competitor suggestions and similar-creator opportunities are not verified facts.**
  Competitor suggestions are explicitly AI-generated and labelled as such in the UI;
  creator opportunities are rule-based (no embeddings) and labelled as suggestions.
- **Dashboard figures based on detected placements are not verified brand spend.**

### Video-processing limitations

- Real per-frame/per-second video and audio inspection by Gemini only occurs for
  chunks with an authorised media reference. Without one, Gemini still runs (a real API
  call, not a stub) using title/description/transcript context, and any
  audio/visual-sourced evidence it still reports is capped to a low strength so it
  cannot alone drive a stop decision.
- Targeted, higher-frequency (2–4 fps) frame analysis for a short window is the
  documented behaviour for likely sponsor transitions/URLs, but requires an authorised
  media source to actually sample frames from; it is not applied to a whole video by
  default in any case.
- Chunk length is fixed per video (30s under 10 minutes, else 60s) rather than
  dynamically adjusted mid-video.

## Definition of "done" checks

```bash
npx tsc --noEmit    # strict TypeScript
npm run lint        # ESLint
npm test            # Vitest
npm run test:e2e    # Playwright
npm run build        # production build
```
