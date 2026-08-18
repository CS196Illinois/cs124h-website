import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnv = dotenv.config({ path: path.resolve(__dirname, ".env.test.local"), quiet: true }).parsed || {};

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // All spec files share the same live Supabase test_ tables (no per-file
  // isolation), and each file's beforeEach wipes those tables via
  // clearAllTestTables(). Parallel workers raced each other's cleanup against
  // other files' in-flight tests — same class of bug as the Vitest suite, fixed
  // the same way: run everything on one worker, one file at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  // Runs the real Next.js dev server, pinned to test_-prefixed Supabase
  // tables (USE_TEST_TABLES / NEXT_PUBLIC_USE_TEST_TABLES from .env.test.local)
  // on a dedicated port so it never collides with a developer's own `npm run dev`.
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // process.env first so CI-injected secrets (no .env.test.local exists
      // there) always reach the spawned server; testEnv overrides for local
      // dev where the file is the source of truth.
      ...process.env,
      ...testEnv,
      PORT: String(PORT),
      NEXTAUTH_URL: BASE_URL,
      AUTH_URL: BASE_URL,
    },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
