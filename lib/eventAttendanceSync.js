/**
 * Syncs one event's attendance into its tab in the shared Google Sheet.
 * Called after every check-in (fire-and-forget, via next/server's after())
 * and from the manual "Sync now" button - both paths funnel through here so
 * they can never drift apart.
 */
import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { sheetsClient, spreadsheetId, ensureEventTab } from "./googleSheets";

const HEADER_ROW = ["Net ID", "Name", "Checked In At"];

export async function syncEventAttendance(eventId) {
  // There's no test-mode Google Sheet - never let the E2E/test suite (which
  // runs against test_-prefixed tables) touch the real production sheet.
  if (process.env.USE_TEST_TABLES === "true") return;

  const { data: event, error: eventError } = await supabaseServer
    .from(table("events"))
    .select("id, title, start_time, sheet_tab_gid")
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
  if (netIds.length) {
    const { data: users } = await supabaseServer
      .from(table("users"))
      .select("net_id, name")
      .in("net_id", netIds);
    nameByNetId = Object.fromEntries((users || []).map((u) => [u.net_id, u.name || ""]));
  }

  const tabName = await ensureEventTab(event, async (gid) => {
    const { error } = await supabaseServer
      .from(table("events"))
      .update({ sheet_tab_gid: gid })
      .eq("id", eventId);
    if (error) throw new Error(`syncEventAttendance: failed to persist sheet_tab_gid: ${error.message}`);
  });

  const rows = [
    HEADER_ROW,
    ...(checkins || []).map((c) => [
      c.net_id,
      nameByNetId[c.net_id] || "",
      new Date(c.checked_in_at).toLocaleString("en-US"),
    ]),
  ];

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
