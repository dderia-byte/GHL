import { GoogleGenAI, type Part } from "@google/genai";
import { getEnv } from "@/lib/env";
import { extractJsonPayload } from "@/lib/json-extract";
import { buildChunkAnalysisPrompt } from "../prompt";
import {
  geminiChunkRawResponseSchema,
  type AnalysisInputsUsed,
  type MediaReference,
  type MediaSourceMethod,
  type SponsorRecognitionResult,
  type VideoAnalysisContext,
  type VideoAnalysisProvider,
  type VideoChunk,
} from "../types";

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export class GeminiConfigurationError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSecondsOffset(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

/**
 * Real Gemini multimodal video-analysis provider. Requires GEMINI_API_KEY.
 *
 * For a chunk whose `mediaReference` is `{ type: "YOUTUBE_URL" }`, the video's own
 * public `youtube.com/watch?v=...` URL is passed directly to Gemini as native video
 * input (scoped to that chunk's time window via `videoMetadata`) — Gemini fetches and
 * decodes the video itself, so this system never downloads or scrapes it. Only works
 * for public videos. `GEMINI_FILE`/`LOCAL_UPLOAD` cover an operator-supplied file for
 * private/unlisted videos or any other legitimately obtained raw file. `null` means no
 * real media at all — the request runs text-only (title/description/transcript) and is
 * labelled as such throughout, never presented as if real video/audio was inspected.
 *
 * The model's own self-reported "I analysed the video/audio/frames" flags are never
 * trusted as-is: they're cross-checked against Gemini's server-side per-modality token
 * usage (`usageMetadata.promptTokensDetails`) before being reported anywhere. If that
 * cross-check disagrees, or the direct video request fails outright even after
 * retries, the chunk automatically falls back to a text-only request and the failure is
 * recorded on `analysisInputs.providerError` rather than hidden.
 */
export class GeminiVideoAnalysisProvider implements VideoAnalysisProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(
    private readonly apiKey: string = getEnv().GEMINI_API_KEY,
    private readonly model: string = getEnv().GEMINI_VIDEO_MODEL,
    client?: GoogleGenAI,
  ) {
    if (!this.apiKey) {
      throw new GeminiConfigurationError("GeminiVideoAnalysisProvider requires GEMINI_API_KEY to be configured.");
    }
    this.client = client ?? new GoogleGenAI({ apiKey: this.apiKey });
  }

  async analyseChunk(chunk: VideoChunk, context: VideoAnalysisContext): Promise<SponsorRecognitionResult> {
    if (!chunk.mediaReference) {
      return this.runRequest(chunk, context, null, "NONE");
    }

    const mediaSourceMethod: MediaSourceMethod = chunk.mediaReference.type;
    try {
      return await this.runRequest(chunk, context, chunk.mediaReference, mediaSourceMethod);
    } catch (mediaError) {
      // Direct video access failed even after retries — fall back to a text-only
      // request so transcript/description evidence can still be gathered instead of
      // losing the chunk entirely. The failure is recorded, never hidden.
      const providerError = mediaError instanceof Error ? mediaError.message : String(mediaError);
      const fallback = await this.runRequest(chunk, context, null, "NONE").catch((textError) => {
        throw new Error(
          `Gemini chunk analysis failed: video access failed (${providerError}) and the text-only fallback also failed: ${
            textError instanceof Error ? textError.message : String(textError)
          }`,
        );
      });
      fallback.analysisInputs.providerError = `Gemini could not access the public YouTube video. Native audio and visuals were not analysed. (${providerError})`;
      return fallback;
    }
  }

  private async buildMediaPart(mediaReference: MediaReference, chunk: VideoChunk): Promise<Part> {
    if (mediaReference.type === "YOUTUBE_URL") {
      return {
        fileData: { fileUri: mediaReference.url, mimeType: "video/*" },
        videoMetadata: { startOffset: toSecondsOffset(chunk.startSeconds), endOffset: toSecondsOffset(chunk.endSeconds) },
      };
    }
    if (mediaReference.type === "GEMINI_FILE") {
      return { fileData: { fileUri: mediaReference.uri, mimeType: mediaReference.mimeType } };
    }
    // LOCAL_UPLOAD: upload the operator-supplied file to Gemini's Files API first, then
    // reference the resulting URI exactly like GEMINI_FILE from that point on.
    const uploaded = await this.uploadLocalFile(mediaReference.path, mediaReference.mimeType);
    return { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } };
  }

  private async uploadLocalFile(path: string, mimeType: string): Promise<{ uri: string; mimeType: string }> {
    let file = await this.client.files.upload({ file: path, config: { mimeType } });
    const deadline = Date.now() + 60_000;
    while (file.state === "PROCESSING" && Date.now() < deadline && file.name) {
      await sleep(1000);
      file = await this.client.files.get({ name: file.name });
    }
    if (file.state !== "ACTIVE" || !file.uri) {
      throw new Error(`Gemini file upload for "${path}" did not become ACTIVE (state: ${file.state ?? "unknown"}).`);
    }
    return { uri: file.uri, mimeType: file.mimeType ?? mimeType };
  }

  private async runRequest(
    chunk: VideoChunk,
    context: VideoAnalysisContext,
    mediaReference: MediaReference | null,
    mediaSourceMethod: MediaSourceMethod,
  ): Promise<SponsorRecognitionResult> {
    const hasMediaInput = mediaReference !== null;
    const prompt = buildChunkAnalysisPrompt(chunk, context, hasMediaInput);

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const parts: Part[] = [];
        if (mediaReference) parts.push(await this.buildMediaPart(mediaReference, chunk));
        parts.push({ text: prompt });

        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [{ role: "user", parts }],
          config: { temperature: 0, responseMimeType: "application/json" },
        });

        const text = response.text;
        if (!text) throw new Error("Gemini API returned an empty response");

        const jsonPayload = extractJsonPayload(text);
        const raw = geminiChunkRawResponseSchema.parse(JSON.parse(jsonPayload));

        const usage = response.usageMetadata?.promptTokensDetails ?? [];
        const serverConfirmedMedia = usage.some((m) => m.modality === "VIDEO" || m.modality === "AUDIO");

        if (hasMediaInput && !serverConfirmedMedia) {
          // Gemini returned a response but its own token accounting shows it never
          // actually ingested the video/audio (e.g. an inaccessible or private URL that
          // it silently ignored) — treat this exactly like a hard failure so the
          // standard retry-then-fallback path handles it, rather than quietly
          // returning a result that looks like real video analysis.
          throw new Error("Gemini did not report any VIDEO/AUDIO token usage for the supplied media reference.");
        }

        // Never trust the model's self-report alone: real modality usage must show up
        // in the provider's own server-side accounting, or we downgrade.
        const videoInputAnalysed = hasMediaInput && serverConfirmedMedia && raw.videoInputAnalysed;
        const nativeAudioAnalysed = videoInputAnalysed && raw.nativeAudioAnalysed;
        const visualFramesAnalysed = videoInputAnalysed && raw.visualFramesAnalysed;

        const evidence = raw.evidence.map((e) => {
          const needsAudioConfirmation = e.source === "VIDEO_AUDIO" && !nativeAudioAnalysed;
          const needsVisualConfirmation = e.source === "VIDEO_VISUAL" && !visualFramesAnalysed;
          if (!needsAudioConfirmation && !needsVisualConfirmation) return e;
          // Evidence claiming to be heard/seen without confirmed real media input is
          // never trustworthy — downgrade rather than silently keep it as if grounded
          // in something real.
          return { ...e, strength: Math.min(e.strength, 0.3), metadata: { ...e.metadata, unconfirmedMediaInput: true } };
        });

        const analysisInputs: AnalysisInputsUsed = {
          mediaSourceMethod,
          videoInputAnalysed,
          nativeAudioAnalysed,
          visualFramesAnalysed,
          transcriptProvided: context.transcriptSegments.length > 0,
          descriptionProvided: context.description.trim().length > 0,
          model: this.model,
          providerError: null,
        };

        return {
          recognised: raw.recognised,
          brandName: raw.brandName,
          brandDomain: raw.brandDomain,
          placementType: raw.placementType,
          sponsorshipConfirmed: raw.sponsorshipConfirmed,
          confidenceScore: raw.confidenceScore,
          startTimestampSeconds: raw.startTimestampSeconds,
          endTimestampSeconds: raw.endTimestampSeconds,
          evidence,
          reason: raw.reason,
          analysisInputs,
        };
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
      }
    }

    throw new Error(
      `Gemini chunk analysis failed after ${MAX_RETRIES + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
