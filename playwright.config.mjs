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
  // other files' in-flight tests - same class of bug as the Vitest suite, fixed
  // the same way: run everything on one worker, one file at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",

  // Allow for real test-database round trips. Routes are precompiled by the
  // production build below, so workflow timing doesn't depend on test order.
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  // Runs a production build/server, pinned to test_-prefixed Supabase
  // tables (USE_TEST_TABLES / NEXT_PUBLIC_USE_TEST_TABLES from .env.test.local)
  // on a dedicated port so it never collides with a developer's own `npm run dev`.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    env: {
      // process.env first so CI-injected secrets (no .env.test.local exists
      // there) always reach the spawned server; testEnv overrides for local
      // dev where the file is the source of truth.
      ...process.env,
      ...testEnv,
      USE_TEST_TABLES: "true",
      NEXT_PUBLIC_USE_TEST_TABLES: "true",
      NEXT_PUBLIC_E2E: "true",
      PORT: String(PORT),
      NEXTAUTH_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      // Build into a separate folder so a running `npm run dev` (which owns
      // .next) can't corrupt the test build, and vice versa.
      NEXT_DIST_DIR: ".next-e2e",
    },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
