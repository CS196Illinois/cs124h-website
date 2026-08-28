import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
