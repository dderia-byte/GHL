# Accuracy audit — why system results trail manual research

Audit of the system as it stood before the accuracy work, written against the actual
code (not an idealised design). Grounded in: `src/lib/discovery/`,
`src/lib/sponsor-analysis/`, `src/lib/brand/`, `src/lib/decision/`, `prisma/schema.prisma`.

## 1. Current architecture (as built)

```
Discovery run ─ search.list ─▶ dedupe (intra-run / known / cooldown)
                                    │
                              free filters (subscriber cap, niche keywords, activity)
                                    │
                              free gate: Stage-1 description scan over N recent uploads
                                    │
                              paid gating (ranked signal videos) ─▶ qualify
                                    │
                              deep scan: latest N uploads ─▶ three-stage pipeline
                                                                │
   Stage 1 deterministic (description/metadata, $0) ─▶ Stage 2 transcript windows
   (cheap model) ─▶ Stage 3 native Gemini video windows ─▶ decision engine (≥0.90 stop)
                                                                │
                                              SponsorshipDetection + SponsorEvidence
                                                                │
                                    Brand ─▶ CreatorOpportunity (rule-based score)
```

## 2. Strengths worth preserving

- **Evidence is already first-class.** `SponsorEvidence` stores source, timestamp, text
  and strength per detection; the pipeline never reports a modality it didn't use
  (`analysisInputs` is cross-checked against real Gemini token usage).
- **Cost/quota discipline is genuinely good.** Three-stage escalation, hash-based reuse,
  reserve-then-commit ledgers, per-video caps. Accuracy work should spend *more* on the
  right things, not dismantle this.
- **Deduplication is sound**: unique `youtubeChannelId` / `youtubeVideoId`, per-run
  candidate uniqueness, rejection cooldowns, content-hash reuse.
- **Human review is mandatory** — nothing is auto-confirmed.
- **Provider abstraction + keyless mocks** keep the system testable end-to-end.

## 3. Weaknesses — root causes of lower-than-manual accuracy

### 3.1 No performance intelligence (highest impact)
`Channel` stores `subscriberCount` only. The single view metric in the system is an
inline `averageRecentViews` over the last 10 uploads in
`refreshCreatorOpportunitiesForBrand` — computed on the fly, never stored, and:

- **Shorts and long-form are averaged together.** `Video.durationSeconds` exists but is
  never used to separate them. A creator whose Shorts pull 400k views and long-form
  pulls 3k looks like a 200k-view creator. This alone can invert a ranking.
- No median (so one viral video skews the mean), no engagement rate, no view trend, no
  upload cadence, no consistency measure.
- `scoreCreatorOpportunity` adds `log10(subscriberCount) × 2` directly to the score —
  i.e. **subscriber count materially drives recommendations**, which is exactly the
  failure mode manual research avoids.

### 3.2 Creator content is never actually classified
`Channel.category` is either operator-typed or, for discovered creators, the *discovery
query label* — not derived from the creator's content at all. Matching then does
`slugify(channelCategory) === slugify(brandCategory)` string equality, with a substring
fallback over recent titles/descriptions. There is no notion of primary/secondary niche,
no weighting, no technical-depth or audience-intent signal.

### 3.3 Brand matching has no semantic layer
`categoryMatches` is exact-slug equality. PostHog and Mixpanel are unrelated to this
system unless an AI competitor suggestion happens to name one. Related-product families
(hosting, analytics, AI assistants) are invisible, so genuinely strong matches score low
and keyword-coincidence matches score high.

### 3.4 One score conflates two different questions
`opportunityScore` mixes "is this creator suitable?" with "how much do we actually
know?". A creator with one analysed video and no transcript can outrank a thoroughly
evidenced one. There is no confidence dimension anywhere in the system.

### 3.5 Negative signals barely exist
Only `conflictWarning` (competitor previously promoted). Nothing detects declining
views, Shorts-dominant audiences, sponsor saturation, inactivity, subscriber-to-view
inflation, or missing contact routes — the very reasons a human rejects a creator.

### 3.6 No feedback loop
`reviewStatus` on detections is captured but never influences ranking. The system cannot
learn from approvals/rejections, and there is no measurement of its own precision.

### 3.7 Video selection ignores format
`deepScanVideoIds` takes the latest N uploads regardless of duration, so Shorts consume
analysis budget and pollute sponsorship-frequency maths.

### 3.8 Sponsorship typing is under-determined
`PlacementType` exists and the Anthropic classifier populates it, but there is no
deterministic separation of paid sponsorship vs affiliate-only vs creator-owned product
vs platform referral, and no per-brand repeat-sponsor tracking (a repeated sponsor is far
stronger evidence of commercial activity than a one-off).

### 3.9 No contact data
Business email, socials and media-kit links are never extracted, though the channel
description containing them is already fetched. Results are therefore not actionable
without manual lookup.

### 3.10 Scalability wrinkle
`refreshCreatorOpportunitiesForBrand` loads **every** channel with 10 videos each and
upserts an opportunity row per channel — an unbounded full scan per brand.

## 4. Missing signals summary

| Category | Missing |
|---|---|
| Performance | long-form vs Shorts split, avg/median views (10 & 25), engagement rate, view trend, upload cadence, consistency |
| Content | derived primary/secondary niche, weighted topics, technical depth, audience intent |
| Commercial | sponsorship frequency, repeat sponsors, sponsor saturation, paid-vs-affiliate split |
| Brand | product category taxonomy, related/competitor families, buyer persona, target roles |
| Reliability | confidence score, evidence counts, data freshness, unknown-vs-negative separation |
| Contact | business email, socials, website, media kit |
| Learning | decision capture, pattern analysis, precision measurement |

## 5. Improvement plan (ordered by accuracy impact)

1. **Creator performance profile** — long-form/Shorts separation, view statistics,
   engagement, cadence, trend, sponsorship frequency, contact extraction. Everything
   downstream depends on this.
2. **Content classification** — weighted multi-niche profile derived from titles,
   descriptions and transcripts.
3. **Sponsorship evidence tiers** — deterministic confidence tiers and relationship
   typing (paid / affiliate / organic / own product), repeat-sponsor tracking.
4. **Brand profiles + relatedness** — structured brand intelligence with a product
   taxonomy so related tools score as related.
5. **Two-dimensional scoring** — configurable weighted match score out of 100 **and** a
   separate confidence score, with positive / negative / unknown signals stored apart.
6. **Feedback learning** — capture decisions with reasons, surface patterns, measure
   precision against human judgement.

Rules carried through all of the above: never present an assumption as a fact, store the
evidence behind every claim, mark unavailable data as unknown rather than guessing, and
never let subscriber count alone drive a recommendation.
