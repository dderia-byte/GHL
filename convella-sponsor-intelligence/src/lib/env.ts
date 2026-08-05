import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  YOUTUBE_API_KEY: z.string().optional().default(""),
  // Overridable only for local end-to-end testing (see tests/e2e) so it can point at
  // a local mock server instead of the real YouTube Data API. Defaults to the real API.
  YOUTUBE_API_BASE_URL: z.string().optional().default("https://www.googleapis.com/youtube/v3"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().optional().default("claude-sonnet-4-5-20250929"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_VIDEO_MODEL: z.string().optional().default("gemini-2.5-pro"),
  APP_URL: z.string().optional().default("http://localhost:3000"),
  TRANSCRIPT_PROVIDER: z.enum(["manual", "uploaded_file", "mock"]).optional().default("manual"),
  VIDEO_ANALYSIS_PROVIDER: z.enum(["gemini", "mock"]).optional().default("gemini"),
  /// Creator-discovery search. "youtube" needs YOUTUBE_API_KEY (and falls back to
  /// mock without one, matching the other providers' keyless-fallback convention).
  DISCOVERY_SEARCH_PROVIDER: z.enum(["youtube", "mock"]).optional().default("youtube"),
  DEFAULT_ANALYSIS_MODE: z.enum(["FIRST_SPONSOR_ONLY", "ALL_SPONSORS"]).optional().default("FIRST_SPONSOR_ONLY"),
  DEFAULT_CHUNK_SECONDS: z.coerce.number().int().positive().optional().default(60),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().optional().default(250),

  // Three-stage cost-optimised sponsor-analysis pipeline (src/lib/sponsor-analysis/).
  ANALYSIS_PIPELINE_VERSION: z.coerce.number().int().positive().optional().default(2),
  CHEAP_TEXT_MODEL: z.string().optional().default(""),
  REASONING_MODEL: z.string().optional().default(""),
  MAX_TRANSCRIPT_WINDOWS: z.coerce.number().int().positive().optional().default(3),
  TRANSCRIPT_CONTEXT_BEFORE_SECONDS: z.coerce.number().int().nonnegative().optional().default(30),
  TRANSCRIPT_CONTEXT_AFTER_SECONDS: z.coerce.number().int().nonnegative().optional().default(60),
  MAX_TRANSCRIPT_MODEL_CHARS: z.coerce.number().int().positive().optional().default(12000),
  ENABLE_NATIVE_VIDEO_ANALYSIS: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  VIDEO_WINDOW_SECONDS: z.coerce.number().int().positive().optional().default(90),
  MAX_VIDEO_WINDOWS: z.coerce.number().int().positive().optional().default(3),
  MAX_NATIVE_VIDEO_CALLS_PER_VIDEO: z.coerce.number().int().positive().optional().default(3),
  MAX_NATIVE_VIDEO_SECONDS_PER_VIDEO: z.coerce.number().int().positive().optional().default(300),
  MAX_ESTIMATED_COST_PER_VIDEO_USD: z.coerce.number().positive().optional().default(0.15),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

/** Parses and validates process.env once, never logging the raw values (secrets stay out of logs). */
export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function hasGeminiCredentials(): boolean {
  return getEnv().GEMINI_API_KEY.length > 0;
}

export function hasAnthropicCredentials(): boolean {
  return getEnv().ANTHROPIC_API_KEY.length > 0;
}

export function hasYouTubeCredentials(): boolean {
  return getEnv().YOUTUBE_API_KEY.length > 0;
}

/** Stage 2's cheap transcript-classification model — falls back to ANTHROPIC_MODEL if unset. */
export function getCheapTextModel(): string {
  const env = getEnv();
  return env.CHEAP_TEXT_MODEL || env.ANTHROPIC_MODEL;
}

/** The reasoning model used for brand normalisation / conflicting-evidence classification — falls back to ANTHROPIC_MODEL if unset. */
export function getReasoningModel(): string {
  const env = getEnv();
  return env.REASONING_MODEL || env.ANTHROPIC_MODEL;
}
