export const E2E_DATABASE_URL = "postgresql://convella:convella@localhost:5432/convella_e2e_test?schema=public";
export const MOCK_YOUTUBE_PORT = 4567;

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  YOUTUBE_API_KEY: "e2e-dummy-key",
  YOUTUBE_API_BASE_URL: `http://localhost:${MOCK_YOUTUBE_PORT}`,
  VIDEO_ANALYSIS_PROVIDER: "mock",
  TRANSCRIPT_PROVIDER: "mock",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",
  DEFAULT_CHUNK_SECONDS: "30",
};
