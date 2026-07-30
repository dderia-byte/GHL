// Ensures getEnv() has a valid (dummy) DATABASE_URL in tests that don't touch Prisma directly,
// without overriding any real values already present (e.g. from a loaded .env in dev).
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
