import { getEnv } from "@/lib/env";
import { extractJsonPayload } from "@/lib/json-extract";
import { buildChunkAnalysisPrompt } from "../prompt";
import {
  sponsorRecognitionResultSchema,
  type SponsorRecognitionResult,
  type VideoAnalysisContext,
  type VideoAnalysisProvider,
  type VideoChunk,
} from "../types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RETRIES = 2;

export class GeminiConfigurationError extends Error {}

/**
 * Real Gemini multimodal video-analysis provider. Requires GEMINI_API_KEY.
 *
 * When `chunk.mediaReference` points at authorised media (a Gemini Files API URI
 * for content the operator uploaded with permission), that media is attached to the
 * request so Gemini can inspect the actual audio/visuals for the chunk. When no
 * authorised media reference is available for a chunk, the call still runs against
 * the real Gemini API using title/description/transcript context only, and the
 * result is annotated so downstream code knows visual/audio inspection did not occur.
 *
 * This provider never downloads YouTube video or audio itself — that would bypass
 * YouTube's technical controls, which this system does not do.
 */
export class GeminiVideoAnalysisProvider implements VideoAnalysisProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string = getEnv().GEMINI_API_KEY,
    private readonly model: string = getEnv().GEMINI_VIDEO_MODEL,
  ) {
    if (!this.apiKey) {
      throw new GeminiConfigurationError(
        "GeminiVideoAnalysisProvider requires GEMINI_API_KEY to be configured.",
      );
    }
  }

  async analyseChunk(chunk: VideoChunk, context: VideoAnalysisContext): Promise<SponsorRecognitionResult> {
    const prompt = buildChunkAnalysisPrompt(chunk, context);
    const hasAuthorisedMedia = chunk.mediaReference.length > 0;

    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (hasAuthorisedMedia) {
      parts.unshift({
        fileData: {
          fileUri: chunk.mediaReference,
          mimeType: "video/mp4",
        },
      });
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(
          `${GEMINI_ENDPOINT}/${encodeURIComponent(this.model)}:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: { temperature: 0, responseMimeType: "application/json" },
            }),
          },
        );

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`Gemini API error ${response.status}: ${body.slice(0, 500)}`);
        }

        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (!text) throw new Error("Gemini API returned an empty response");

        const jsonPayload = extractJsonPayload(text);
        const parsed = sponsorRecognitionResultSchema.parse(JSON.parse(jsonPayload));

        if (!hasAuthorisedMedia) {
          parsed.evidence = parsed.evidence.map((e) =>
            e.source === "VIDEO_AUDIO" || e.source === "VIDEO_VISUAL"
              ? { ...e, strength: Math.min(e.strength, 0.3), metadata: { ...e.metadata, noAuthorisedMedia: true } }
              : e,
          );
        }

        return parsed;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Gemini chunk analysis failed after ${MAX_RETRIES + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
