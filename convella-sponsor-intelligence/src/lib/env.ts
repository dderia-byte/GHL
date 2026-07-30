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
  DEFAULT_ANALYSIS_MODE: z.enum(["FIRST_SPONSOR_ONLY", "ALL_SPONSORS"]).optional().default("FIRST_SPONSOR_ONLY"),
  DEFAULT_CHUNK_SECONDS: z.coerce.number().int().positive().optional().default(60),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().optional().default(250),
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
