/**
 * Single source of truth for Supabase table names.
 *
 * When USE_TEST_TABLES=true (set by the Vitest/Playwright test envs), every
 * lookup resolves to a test_-prefixed twin of the real table instead — so
 * running the test suite can never read or write production data. Every
 * Supabase `.from(...)` call in the app MUST go through `table()` rather than
 * hardcoding a table name string.
 */

const TABLE_NAMES = {
  users: "user-testing",
  actionItems: "action_items",
  roleViewRequests: "role_view_requests",
  events: "events",
  eventCheckins: "event_checkins",
  sprints: "sprints",
  sprintCompletions: "sprint_completions",
  sandboxOverlay: "sandbox_overlay",
  staff: "staff",
  resources: "resources",
  projects: "projects",
  // Reconciled with production (cs124h-website): the leaderboard moved from
  // the old attendance_sheet table to a semester-specific attendance table.
  // This name will need to change again next semester.
  eventAttendanceSp26: "event_attendance_sp26",
};

function isTestMode() {
  // USE_TEST_TABLES is read server-side (API routes, server components).
  // NEXT_PUBLIC_USE_TEST_TABLES is the client-bundle-visible twin, needed by
  // the handful of "use client" components that query Supabase directly.
  return (
    process.env.USE_TEST_TABLES === "true" ||
    process.env.NEXT_PUBLIC_USE_TEST_TABLES === "true"
  );
}

/** @param {keyof typeof TABLE_NAMES} key */
export function table(key) {
  const base = TABLE_NAMES[key];
  if (!base) throw new Error(`Unknown table key: "${key}"`);
  return isTestMode() ? `test_${base}` : base;
}
