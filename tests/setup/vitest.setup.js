import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loads USE_TEST_TABLES + Supabase/NextAuth creds. Must happen before any
// test imports a route handler, since those modules read process.env lazily
// (see lib/tables.js) but Supabase clients are constructed once and cached.
dotenv.config({ path: path.resolve(__dirname, "../../.env.test.local"), quiet: true });

if (process.env.USE_TEST_TABLES !== "true") {
  throw new Error(
    "USE_TEST_TABLES must be true when running the test suite - refusing to start " +
    "to avoid ever touching production tables. Check .env.test.local."
  );
}

// next/server's after() throws synchronously when called outside a real
// request's async context - which route handlers invoked directly here
// (not through an actual Next.js server, unlike the Playwright E2E suite)
// never have. Without this, every route that schedules fire-and-forget
// background work via after() (checkin, manual checkin, user role/delete
// routes) crashes before ever returning its response, instead of just
// running the callback - global so every test file is covered, not only
// ones that remember to mock it themselves.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, after: (fn) => { fn(); } };
});
