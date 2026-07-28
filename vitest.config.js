import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup/vitest.setup.js"],
    include: ["tests/api/**/*.test.js"],
    testTimeout: 15000,
    hookTimeout: 20000,
    // All test files share the same live Supabase test_ tables (no per-file
    // isolation), and each file's beforeEach wipes those tables. Running
    // files in parallel means one file's cleanup can delete rows a different
    // file's in-flight test still depends on — so files must run sequentially.
    fileParallelism: false,
  },
});
