import { createClient } from "@supabase/supabase-js";
import { table } from "../../lib/tables";

/**
 * Seed/cleanup helpers shared by both the Vitest and Playwright suites (both
 * run in plain Node, so there's no reason to duplicate this). Every helper
 * here goes through table() and hard-refuses to run without
 * USE_TEST_TABLES=true, so there is no path by which a test can touch
 * production data.
 */

let _client;
function client() {
  if (process.env.USE_TEST_TABLES !== "true") {
    throw new Error("Refusing to create a test-data DB client without USE_TEST_TABLES=true");
  }
  if (!_client) {
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  }
  return _client;
}

function rand(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Insert helpers ─────────────────────────────────────────────────────────

export async function insertUser(overrides = {}) {
  const row = {
    net_id: rand("t"),
    role: "STUDENT",
    group_number: null,
    sub: null,
    name: null,
    discord_user_id: null,
    ...overrides,
  };
  const { data, error } = await client().from(table("users")).upsert(row).select().single();
  if (error) throw new Error(`insertUser: ${error.message}`);
  return data;
}

export async function insertActionItem(overrides = {}) {
  const row = {
    net_id: overrides.net_id,
    assigned_by: overrides.assigned_by ?? null,
    title: overrides.title ?? "Test action item",
    description: null,
    due_date: null,
    is_gradable: false,
    max_score: null,
    batch_id: null,
    additional_info: overrides.assigned_by ? { assigned_by: overrides.assigned_by } : null,
    ...overrides,
  };
  if (!row.net_id) throw new Error("insertActionItem requires net_id");
  const { data, error } = await client().from(table("actionItems")).insert(row).select().single();
  if (error) throw new Error(`insertActionItem: ${error.message}`);
  return data;
}

export async function insertRoleViewRequest(overrides = {}) {
  const row = {
    requester_net_id: overrides.requester_net_id,
    requested_role: overrides.requested_role ?? "student",
    status: "pending",
    ...overrides,
  };
  const { data, error } = await client().from(table("roleViewRequests")).insert(row).select().single();
  if (error) throw new Error(`insertRoleViewRequest: ${error.message}`);
  return data;
}

export async function insertSprint(overrides = {}) {
  const row = {
    number: 0,
    goal: "Test sprint",
    start_date: null,
    end_date: null,
    ...overrides,
  };
  const { data, error } = await client().from(table("sprints")).insert(row).select().single();
  if (error) throw new Error(`insertSprint: ${error.message}`);
  return data;
}

export async function insertEvent(overrides = {}) {
  const row = {
    title: "Test event",
    description: null,
    location: null,
    presenter: null,
    point_value: 10,
    qr_code_secret: "1234",
    is_active: true,
    check_in_open: false,
    checked_in_students: [],
    ...overrides,
  };
  const { data, error } = await client().from(table("events")).insert(row).select().single();
  if (error) throw new Error(`insertEvent: ${error.message}`);
  return data;
}

export async function insertStaff(overrides = {}) {
  const row = {
    semester: "Test Semester",
    semester_order: 0,
    member_order: 0,
    name: "Test Staffer",
    role: "PM",
    ...overrides,
  };
  const { data, error } = await client().from(table("staff")).insert(row).select().single();
  if (error) throw new Error(`insertStaff: ${error.message}`);
  return data;
}

export async function insertProject(overrides = {}) {
  const row = {
    title: "Test Project",
    description: "A test project",
    members: ["Test Member"],
    semester: "Test Semester",
    semester_order: 0,
    project_order: 0,
    ...overrides,
  };
  const { data, error } = await client().from(table("projects")).insert(row).select().single();
  if (error) throw new Error(`insertProject: ${error.message}`);
  return data;
}

export async function insertSandboxOverlay(overrides = {}) {
  const row = {
    owner_net_id: overrides.owner_net_id,
    table_key: overrides.table_key,
    row_pk: overrides.row_pk,
    op: overrides.op ?? "insert",
    row_data: overrides.row_data ?? null,
    ...overrides,
  };
  if (!row.owner_net_id || !row.table_key || !row.row_pk) {
    throw new Error("insertSandboxOverlay requires owner_net_id, table_key, and row_pk");
  }
  const { data, error } = await client().from(table("sandboxOverlay")).insert(row).select().single();
  if (error) throw new Error(`insertSandboxOverlay: ${error.message}`);
  return data;
}

// Matches production's actual (mixed-case) column names on
// event_attendance_sp26 — the leaderboard route resolves them
// case-insensitively, so tests exercise that instead of assuming a
// convenient lowercase schema.
export async function insertEventAttendance(rows) {
  const mapped = rows.map((r) => ({ NAME: r.name, NETID: r.netid, GROUP: r.group, Total: r.total }));
  const { error } = await client().from(table("eventAttendanceSp26")).insert(mapped);
  if (error) throw new Error(`insertEventAttendance: ${error.message}`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────

// Primary key column per table key — used to build a delete-everything filter
// (`not(pk, "is", null)` matches every row regardless of PK type/name).
const TABLE_PK = {
  sprintCompletions: "id",
  eventCheckins: "id",
  actionItems: "id",
  roleViewRequests: "id",
  sprints: "id",
  events: "id",
  eventAttendanceSp26: "id",
  staff: "id",
  resources: "id",
  projects: "id",
  sandboxOverlay: "id",
  users: "net_id",
};

// Children before parents, though FKs are ON DELETE CASCADE anyway.
const CLEAR_ORDER = [
  "sprintCompletions", "eventCheckins", "actionItems", "roleViewRequests",
  "sprints", "events", "eventAttendanceSp26", "staff", "resources", "projects",
  "sandboxOverlay", "users",
];

export async function clearAllTestTables() {
  const c = client();
  for (const key of CLEAR_ORDER) {
    const { error } = await c.from(table(key)).delete().not(TABLE_PK[key], "is", null);
    if (error) throw new Error(`clearAllTestTables(${table(key)}): ${error.message}`);
  }
}

export function testClient() {
  return client();
}
