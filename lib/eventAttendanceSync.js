/**
 * Syncs one event's attendance into its tab in the shared Google Sheet.
 * Called after every check-in (fire-and-forget, via next/server's after())
 * and from the manual "Sync now" button - both paths funnel through here so
 * they can never drift apart.
 *
 * Three reliability properties beyond a bare "write the current rows":
 *  - Retries a transient failure a couple of times before giving up.
 *  - Persists sheet_synced_at / sheet_sync_error onto the event row, so a
 *    stuck sync is visible in the UI instead of only ever showing up in
 *    server logs (see EventsPanel.js).
 *  - Guards against two check-ins landing close together racing each
 *    other: each sync claims a monotonic ticket (sheet_sync_version) and
 *    checks right before writing that no newer sync has since started -
 *    if one has, this one skips its write rather than risk clobbering
 *    fresher data with a stale snapshot.
 */
import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { sheetsClient, spreadsheetId, ensureEventTab } from "./googleSheets";
import { roleLabel } from "./roles";

const HEADER_ROW = ["Net ID", "Name", "Role", "Checked In At"];
const RETRY_DELAYS_MS = [500, 1500]; // 3 total attempts: immediate, +500ms, +1500ms

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Loads the event and builds the exact rows that should be in its tab. */
export async function loadAttendanceData(eventId) {
  const { data: event, error: eventError } = await supabaseServer
    .from(table("events"))
    .select("id, title, start_time, created_by, sheet_tab_gid")
    .eq("id", eventId)
    .single();
  if (eventError) throw new Error(`syncEventAttendance: failed to load event ${eventId}: ${eventError.message}`);
  if (!event) throw new Error(`syncEventAttendance: event ${eventId} not found`);

  const { data: checkins, error: checkinsError } = await supabaseServer
    .from(table("eventCheckins"))
    .select("net_id, checked_in_at")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: true });
  if (checkinsError) throw new Error(`syncEventAttendance: ${checkinsError.message}`);

  const netIds = [...new Set((checkins || []).map((c) => c.net_id))];
  let nameByNetId = {};
  let roleByNetId = {};
  if (netIds.length) {
    const { data: users } = await supabaseServer
      .from(table("users"))
      .select("net_id, name, role")
      .in("net_id", netIds);
    nameByNetId = Object.fromEntries((users || []).map((u) => [u.net_id, u.name || ""]));
    // A manually-added net_id not on the roster (a guest, or a typo) has no
    // matching row here - leave its role blank rather than guessing.
    roleByNetId = Object.fromEntries((users || []).map((u) => [u.net_id, u.role ? roleLabel(u.role) : ""]));
  }

  const rows = [
    HEADER_ROW,
    ...(checkins || []).map((c) => [
      c.net_id,
      nameByNetId[c.net_id] || "",
      roleByNetId[c.net_id] || "",
      new Date(c.checked_in_at).toLocaleString("en-US"),
    ]),
  ];

  return { event, rows };
}

/** Claims a new sync ticket for this event, atomically. */
async function claimSyncTicket(eventId) {
  const { data, error } = await supabaseServer.rpc("increment_sheet_sync_version", {
    p_table: table("events"),
    p_event_id: eventId,
  });
  if (error) throw new Error(`syncEventAttendance: failed to claim a sync ticket: ${error.message}`);
  return data;
}

/** True if a newer sync has claimed a ticket since this one. */
export async function isTicketSuperseded(eventId, ticket) {
  const { data, error } = await supabaseServer
    .from(table("events"))
    .select("sheet_sync_version")
    .eq("id", eventId)
    .single();
  if (error) throw new Error(`syncEventAttendance: failed to check sync version: ${error.message}`);
  return data.sheet_sync_version !== ticket;
}

/** Writes `rows` into `event`'s tab, creating/renaming it as needed. */
async function writeAttendanceToSheet(event, rows) {
  const tabName = await ensureEventTab(event, async (gid) => {
    const { error } = await supabaseServer
      .from(table("events"))
      .update({ sheet_tab_gid: gid })
      .eq("id", event.id);
    if (error) throw new Error(`syncEventAttendance: failed to persist sheet_tab_gid: ${error.message}`);
  });

  const sheets = sheetsClient();
  // Full clear-and-rewrite rather than append: makes re-syncing idempotent
  // regardless of how many times it runs or in what order, and self-heals
  // if a row was ever hand-edited in the sheet.
  await sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId(),
    range: `'${tabName}'!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `'${tabName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

async function markSynced(eventId) {
  const { error } = await supabaseServer
    .from(table("events"))
    .update({ sheet_synced_at: new Date().toISOString(), sheet_sync_error: null })
    .eq("id", eventId);
  if (error) console.error(`syncEventAttendance: failed to record success for event ${eventId}:`, error.message);
}

async function markFailed(eventId, message) {
  const { error } = await supabaseServer
    .from(table("events"))
    .update({ sheet_sync_error: message })
    .eq("id", eventId);
  if (error) console.error(`syncEventAttendance: failed to record failure for event ${eventId}:`, error.message);
}

/**
 * The real sync logic, without the test-mode guard - exported separately so
 * tests can exercise it with lib/googleSheets.js mocked, without needing to
 * defeat the guard on syncEventAttendance() below (which stays absolute for
 * every real call path).
 */
export async function performSync(eventId) {
  const { event, rows } = await loadAttendanceData(eventId);
  const ticket = await claimSyncTicket(eventId);
  return syncWithTicket(eventId, event, rows, ticket);
}

/**
 * The retry + version-guard loop, given an already-claimed ticket. Split
 * out from performSync() so tests can hand it a deliberately-stale ticket
 * and deterministically exercise the "superseded, skip the write" path,
 * instead of needing to race two real concurrent calls against timing.
 */
export async function syncWithTicket(eventId, event, rows, ticket) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (await isTicketSuperseded(eventId, ticket)) {
        // A newer check-in already started its own sync - that one will
        // (or already did) write the fresher state, so writing our older
        // snapshot now would only risk clobbering it. Not an error.
        console.log(`syncEventAttendance: superseded by a newer sync for event ${eventId}, skipping`);
        return;
      }
      await writeAttendanceToSheet(event, rows);
      await markSynced(eventId);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  await markFailed(eventId, lastError.message);
  throw lastError;
}

export async function syncEventAttendance(eventId) {
  // There's no test-mode Google Sheet - never let the E2E/test suite (which
  // runs against test_-prefixed tables) touch the real production sheet.
  if (process.env.USE_TEST_TABLES === "true") return;
  return performSync(eventId);
}
