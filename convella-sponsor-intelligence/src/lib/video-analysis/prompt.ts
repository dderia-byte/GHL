import type { VideoChunk, VideoAnalysisContext } from "./types";

const RESPONSE_SHAPE = `{
  "videoInputAnalysed": boolean,
  "nativeAudioAnalysed": boolean,
  "visualFramesAnalysed": boolean,
  "recognised": boolean,
  "brandName": string | null,
  "brandDomain": string | null,
  "placementType": "DEDICATED_VIDEO" | "SPONSORED_INTEGRATION" | "PRODUCT_PLACEMENT" | "AFFILIATE_PROMOTION" | "FREE_PRODUCT_OR_GIFTED" | "ORGANIC_MENTION" | "CHANNEL_PARTNERSHIP" | "UNKNOWN" | null,
  "sponsorshipConfirmed": boolean,
  "confidenceScore": number between 0 and 1,
  "startTimestampSeconds": integer | null,
  "endTimestampSeconds": integer | null,
  "evidence": [
    { "source": "VIDEO_AUDIO" | "VIDEO_VISUAL" | "TRANSCRIPT" | "DESCRIPTION" | "YOUTUBE_METADATA", "timestampSeconds": integer | null, "text": string, "strength": number between 0 and 1, "metadata": object (optional) }
  ],
  "reason": string
}`;

function buildSharedContextBlock(chunk: VideoChunk, context: VideoAnalysisContext): string {
  const transcriptBlock = context.transcriptSegments.length
    ? context.transcriptSegments
        .map((s) => `[${s.startSeconds ?? "?"}s] ${s.text}`)
        .join("\n")
    : "(no transcript segments available for this window)";

  const previousObservationsBlock = context.previousObservations.length
    ? context.previousObservations
        .map((o) => `- (${o.source}${o.timestampSeconds !== null ? ` @${o.timestampSeconds}s` : ""}) ${o.text}`)
        .join("\n")
    : "(none yet)";

  const candidateBrandsBlock = context.candidateBrands.length
    ? context.candidateBrands.join(", ")
    : "(no candidates extracted from the description)";

  return `VIDEO TITLE: ${context.title}

FULL VIDEO DESCRIPTION:
"""
${context.description || "(no description provided)"}
"""

CANDIDATE SPONSOR BRANDS FROM DESCRIPTION: ${candidateBrandsBlock}

CURRENT CHUNK: seconds ${chunk.startSeconds} to ${chunk.endSeconds}.

TRANSCRIPT CONTEXT FOR THIS WINDOW (includes ~15s of padding before/after):
${transcriptBlock}

PREVIOUSLY OBSERVED EVIDENCE FROM EARLIER CHUNKS (do not repeat, only add new observations):
${previousObservationsBlock}`;
}

const SHARED_STRICT_RULES = `- Do not invent quotes, brand names, domains, timestamps, or discount codes. Only report what is actually present in the evidence available to you for this chunk.
- A logo appearing briefly, an ordinary product demonstration, a competitor comparison, or a company mentioned in passing is NOT sufficient to set "recognised": true or "sponsorshipConfirmed": true.
- Only set "recognised": true and provide a high confidenceScore when there is an explicit commercial signal such as a spoken "sponsored by" / "thanks to X for sponsoring" / "brought to you by" statement, an on-screen paid-promotion disclosure, or a clearly promotional segment matched to a description link/discount code.
- The FULL VIDEO DESCRIPTION above is not scoped to this chunk's time window — it is authoritative context available for every chunk of this video. If the description itself contains an explicit sponsorship-disclosure sentence (e.g. "sponsored by X", "this video is brought to you by X", "in partnership with X", "paid promotion" naming X), you MUST report that sentence as a "DESCRIPTION"-sourced evidence item (timestampSeconds: null, text: the exact disclosure sentence) even if you observe no matching audio/visual confirmation in this specific chunk. On the first chunk of the video (the one starting at 0 seconds), if such a description disclosure exists, set "recognised": true and "brandName" to the disclosed brand based on that description evidence alone — do not withhold recognition merely because this chunk's own audio/visuals don't independently confirm it.
- If nothing conclusive is found anywhere (chunk or description), set "recognised": false and still return any partial evidence (e.g. a brand mention without commercial context) with an honest, lower "strength".
- Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:`;

export function buildChunkAnalysisPrompt(
  chunk: VideoChunk,
  context: VideoAnalysisContext,
  hasMediaInput: boolean,
): string {
  const sharedContext = buildSharedContextBlock(chunk, context);

  if (hasMediaInput) {
    return `You are a meticulous sponsorship-detection analyst.

You have been provided with the actual YouTube video as a native video input, restricted to the time window ${chunk.startSeconds}s-${chunk.endSeconds}s.

Listen to the original audio and inspect the visual frames.

Do not rely only on the transcript or description.

Identify the first genuine paid sponsor.

Separate all evidence into:
- VIDEO_AUDIO
- VIDEO_VISUAL
- TRANSCRIPT
- DESCRIPTION

Only return VIDEO_AUDIO evidence for something actually heard in the original audio.

Only return VIDEO_VISUAL evidence for something actually visible in the video.

${sharedContext}

TASK: Actively analyse the audio and visuals of the attached video for this chunk (spoken words, logos, on-screen text, browser/app URLs, product interfaces, discount codes, QR codes, sponsor cards, tone changes, calls to action). Combine this with the transcript and description context provided above.

Set "videoInputAnalysed" to true (you were given real video for this chunk). Set "nativeAudioAnalysed" to true only if you genuinely processed the audio track, and "visualFramesAnalysed" to true only if you genuinely processed visual frames — do not set either to true just because video was attached if you were, for some reason, unable to actually process that modality.

STRICT RULES:
${SHARED_STRICT_RULES}

${RESPONSE_SHAPE}`;
  }

  return `You are a meticulous sponsorship-detection analyst.

No real video or audio has been provided for this chunk — you only have title, description, and transcript text. Do not claim to have watched or listened to the video. Set "videoInputAnalysed", "nativeAudioAnalysed", and "visualFramesAnalysed" to false, and never return "VIDEO_AUDIO" or "VIDEO_VISUAL" evidence — you have no basis for it.

${sharedContext}

TASK: Analyse the title, description, and transcript text above for commercial/sponsorship signals.

STRICT RULES:
${SHARED_STRICT_RULES}

${RESPONSE_SHAPE}`;
}
