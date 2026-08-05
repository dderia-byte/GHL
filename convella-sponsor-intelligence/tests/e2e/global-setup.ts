import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { startMockYouTubeServer } from "./mock-youtube-server";
import { E2E_DATABASE_URL, E2E_ENV, MOCK_YOUTUBE_PORT } from "./e2e-env";

const ROOT = path.resolve(__dirname, "../..");
const TSX_BIN = path.resolve(ROOT, "node_modules/.bin/tsx");

function killProcessTree(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export default async function globalSetup() {
  // Run in a separate `tsx` process (not required directly by Playwright's own config
  // loader) because the generated Prisma client is ESM-only and Playwright's config
  // loader transpiles to CommonJS.
  execFileSync(TSX_BIN, ["tests/e2e/reset-db.ts"], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: "inherit",
  });

  const mockServer = await startMockYouTubeServer(MOCK_YOUTUBE_PORT);

  const worker: ChildProcess = spawn(TSX_BIN, ["scripts/worker.ts"], {
    cwd: ROOT,
    env: { ...process.env, ...E2E_ENV },
    stdio: "pipe",
    detached: true,
  });
  worker.stdout?.on("data", (d) => process.stdout.write(`[worker] ${d}`));
  worker.stderr?.on("data", (d) => process.stderr.write(`[worker] ${d}`));

  return async () => {
    killProcessTree(worker);
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  };
}
