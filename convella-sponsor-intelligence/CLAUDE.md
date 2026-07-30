@AGENTS.md

# Convella Sponsor Intelligence — notes for Claude Code

Read `README.md` first for the full picture (setup, compliance, architecture). This
file is the shorter, session-to-session cheat sheet.

## What this is

An MVP for an influencer-marketing agency (Convella) that watches YouTube videos
sequentially (audio + visuals + transcript + description + metadata) to find the first
confidently-recognised sponsor, then stops. Every detection needs human review — the
system is deliberately conservative about auto-confirming anything.

## Non-negotiables (do not regress these)

- **Never scrape/download YouTube video or audio.** All metadata comes from the
  official YouTube Data API v3 (`src/lib/youtube/client.ts`). Real-time multimodal
  inspection depends on an *authorised* media reference the operator supplied — see
  `RunVideoAnalysisOptions` / `mediaReference` in
  `src/lib/jobs/video-analysis-pipeline.ts`.
- **The stopping condition is strict**: `recognised && confidence >= 0.90 && explicit
  commercial signal && brand unambiguous`. Don't loosen this to make demos "work" —
  fix the underlying evidence/scoring instead (see `src/lib/decision/`).
- **`FIRST_SPONSOR_ONLY` must stop the loop entirely** once the strict condition is
  met — no further chunks get analysed in that mode.
- **Never invent evidence, quotes, timestamps, domains, or brand relationships.** This
  applies to prompt design (`src/lib/video-analysis/prompt.ts`,
  `src/lib/anthropic/reasoning-service.ts`) as much as to any fallback/heuristic code.
- **All seed/demo data is fictional** (`prisma/seed.ts`) — if you add more, keep it
  obviously fictional and say so in a comment.
- Every provider (transcript, video analysis, AI reasoning) is a small interface with
  a mock/heuristic fallback so the app runs with zero API keys. Keep it that way when
  adding new providers.

## Prisma 7 gotchas (this project uses driver adapters)

- `prisma/schema.prisma`'s `datasource` block has **no `url`** — Prisma 7 forbids it.
  Connection info lives in `prisma.config.ts` (for the CLI/migrations) and in
  `src/lib/db.ts` (constructs `PrismaClient` with `new PrismaPg({ connectionString })`
  for the app itself).
- The generated client lives at `src/generated/prisma` (gitignored) — regenerate with
  `npx prisma generate` after any schema change if `npx prisma migrate dev` doesn't
  already do it.
- The generated client is **ESM-only** (uses `import.meta.url`). Vitest and Next.js
  handle this fine. Playwright's own config/global-setup loader does **not** — see
  `tests/e2e/reset-db.ts` for the workaround (run Prisma-touching code in a separate
  `tsx` child process rather than importing it into `playwright.config.ts` or
  `global-setup.ts` directly).
- BigInt fields (`subscriberCount`, `viewCount`, `likeCount`) need `tsconfig.json`
  `target` at ES2020+ for BigInt literals (`1000n`) to type-check — don't drop it back
  to ES2017.

## Next.js 16 gotchas

- `params` and `searchParams` in pages are `Promise`s — always `await props.params`.
- No `cacheComponents`/PPR is enabled; don't add `"use cache"` directives without
  enabling that config first.
- ESLint is invoked directly (`eslint`, flat config in `eslint.config.mjs`) — `next
  lint` doesn't exist in this version.

## Architecture map (where to add things)

| Concern | Location |
| --- | --- |
| YouTube API client, URL/handle parsing, duration parsing | `src/lib/youtube/` |
| Transcript providers + SRT/VTT/TXT parsers | `src/lib/transcript/` |
| Video analysis providers (Gemini/Mock) + chunk prompt | `src/lib/video-analysis/` |
| Deterministic description/transcript/metadata signal extraction | `src/lib/signals/` |
| Decision engine (scoring, stopping condition, explicit-signal checks) | `src/lib/decision/` |
| Anthropic structured classification + competitor suggestions | `src/lib/anthropic/` |
| Brand normalisation, creator-opportunity scoring, brand service | `src/lib/brand/` |
| Job queue + the sequential per-video pipeline + channel scan pipeline | `src/lib/jobs/` |
| CSV export (formula-injection-safe) | `src/lib/csv/` |
| Zod validation schemas for all mutations | `src/lib/validation/` |
| Pages (dashboard, channels, videos, brands, review, jobs, settings) | `src/app/` |
| Server actions live next to their page (`src/app/**/actions.ts`) | |

## Testing

- `npm test` — Vitest unit + integration tests. Integration tests mock `fetch`
  (`vi.stubGlobal`) for YouTube/Gemini, and mock `@anthropic-ai/sdk` for Anthropic —
  see `tests/integration/`. None of them touch a real database.
- `npm run test:e2e` — Playwright. Requires a **separate** test database
  (`convella_e2e_test`, migrated) — see README's testing section for the one-time
  setup command. `tests/e2e/global-setup.ts` resets that DB, starts a local mock
  YouTube HTTP server, and spawns the real `scripts/worker.ts` (detached process
  group, so teardown can kill the whole tree) against it — the app itself is
  unmodified for testing, only its environment variables point at mocks.
- If you change the mock provider's default script
  (`src/lib/video-analysis/providers/mock.ts`), remember the evidence `strength`
  values need to be realistic enough to actually clear the 0.90 stop threshold through
  the real decision engine — it's easy to accidentally make the demo scenario too
  weak to ever stop (this happened once; see git history / test
  `tests/integration/mock-pipeline.test.ts`).

## Local dev environment used to build this

Local PostgreSQL 16 (not Docker) was used during development in this sandbox because
outbound Docker registry pulls weren't reachable; `docker-compose.yml` is provided and
correct for normal use. If Docker isn't available, create the role/database manually
(matching `.env.example`'s `DATABASE_URL`) and run `npx prisma migrate dev`.
