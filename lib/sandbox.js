/**
 * Dashboard sandbox overlay for web_dev / lead_web_dev.
 *
 * Deliberately scoped to content tables only (action_items, events,
 * event_checkins, sprints, sprint_completions) — users and
 * role_view_requests are never sandboxed, so identity/permissions can't
 * silently diverge from reality inside a session.
 *
 * This is NOT a transparent query interceptor. Each route that wants
 * sandbox-awareness calls mergeSandboxRows()/sandboxWrite() explicitly,
 * passing its own filter/unique-constraint logic as plain JS — reimplementing
 * arbitrary Supabase filter chains generically would mean reimplementing
 * Postgres, which is far riskier than a feature whose whole point is safety
 * should carry.
 */

import { getSupabaseServer } from "./supabaseServer";
import { table } from "./tables";

const SANDBOX_ROLES = new Set(["web_dev", "lead_web_dev"]);
const VALID_MODES = new Set(["off", "ephemeral", "persistent"]);

export function isSandboxRole(role) {
  return SANDBOX_ROLES.has(role);
}

/** Reads the current user's sandbox_mode preference. Defaults to "off". */
export async function getSandboxMode(netID) {
  if (!netID) return "off";
  const { data } = await getSupabaseServer()
    .from(table("users"))
    .select("sandbox_mode")
    .eq("net_id", netID)
    .maybeSingle();
  return data?.sandbox_mode ?? "off";
}

/** Self-service only — callers must verify netID is the requesting user's own. */
export async function setSandboxMode(netID, mode) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Invalid sandbox mode: "${mode}"`);
  }
  const { error } = await getSupabaseServer()
    .from(table("users"))
    .update({ sandbox_mode: mode })
    .eq("net_id", netID);
  if (error) throw new Error(`setSandboxMode: ${error.message}`);
}

async function fetchOverlayRows(ownerNetId, tableKey) {
  const { data, error } = await getSupabaseServer()
    .from(table("sandboxOverlay"))
    .select("*")
    .eq("owner_net_id", ownerNetId)
    .eq("table_key", tableKey);
  if (error) throw new Error(`fetchOverlayRows: ${error.message}`);
  return data ?? [];
}

/**
 * Merges a sandboxed user's overlay diff onto rows already fetched from the
 * real table (baseRows — whatever the caller's own filtered .select() call
 * returned, unchanged). `matchesFilter(rowData)` re-expresses that same
 * filter as a predicate, so a sandbox-only inserted row that would have
 * matched the original query is included too. Every in-scope table uses
 * `id` as its primary key column.
 */
export async function mergeSandboxRows(ownerNetId, tableKey, baseRows, matchesFilter = () => true) {
  const overlay = await fetchOverlayRows(ownerNetId, tableKey);
  if (overlay.length === 0) return baseRows;

  const byPk = new Map(overlay.map((o) => [o.row_pk, o]));
  const merged = [];

  for (const row of baseRows) {
    const pk = String(row.id);
    const ov = byPk.get(pk);
    byPk.delete(pk); // consumed — whatever's left after this loop is unmatched overlay entries
    if (!ov) {
      merged.push(row);
    } else if (ov.op === "update") {
      merged.push(ov.row_data);
    }
    // op === "delete" -> omit entirely
  }

  for (const ov of byPk.values()) {
    if (ov.op === "insert" && matchesFilter(ov.row_data)) {
      merged.push(ov.row_data);
    }
    // leftover "update"/"delete" entries have nothing to merge onto — the
    // real row either doesn't exist or fell outside baseRows' own filter.
  }

  return merged;
}

/**
 * Checks whether writing `rowData` would violate a unique constraint,
 * against both real rows (excluding any deleted-in-overlay) and other
 * overlay entries for this owner. `uniqueCheck` is `{ columns: [...] }`.
 */
async function checkUniqueConflict(ownerNetId, tableKey, uniqueCheck, rowPk, rowData) {
  const { columns } = uniqueCheck;
  const keyValues = columns.map((c) => rowData[c]);

  let realQuery = getSupabaseServer().from(table(tableKey)).select("id");
  for (let i = 0; i < columns.length; i++) realQuery = realQuery.eq(columns[i], keyValues[i]);
  const { data: realMatches, error } = await realQuery;
  if (error) throw new Error(`checkUniqueConflict: ${error.message}`);

  const overlay = await fetchOverlayRows(ownerNetId, tableKey);
  const deletedPks = new Set(overlay.filter((o) => o.op === "delete").map((o) => o.row_pk));

  for (const row of realMatches ?? []) {
    const pk = String(row.id);
    if (pk !== rowPk && !deletedPks.has(pk)) return true;
  }

  for (const ov of overlay) {
    if (ov.op === "delete" || ov.row_pk === rowPk) continue;
    if (columns.every((c, i) => ov.row_data?.[c] === keyValues[i])) return true;
  }

  return false;
}

/**
 * Writes to the sandbox overlay instead of the real table. `op` is
 * "insert" | "update" | "delete"; `rowPk` is the real table's `id` (a
 * client-generated uuid for a sandbox-only insert, since there's no DB
 * default to assign one). `uniqueCheck` is optional `{ columns: [...] }` —
 * on conflict, throws an Error shaped like Postgres's unique-violation
 * (`error.code === "23505"`) so callers' existing handling for that code
 * (e.g. event check-in dedup) works unmodified.
 */
export async function sandboxWrite(ownerNetId, tableKey, op, rowPk, rowData, uniqueCheck) {
  const client = getSupabaseServer();

  if (uniqueCheck && op !== "delete") {
    const conflict = await checkUniqueConflict(ownerNetId, tableKey, uniqueCheck, rowPk, rowData);
    if (conflict) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
  }

  if (op === "delete") {
    const { data: existing } = await client
      .from(table("sandboxOverlay"))
      .select("op")
      .eq("owner_net_id", ownerNetId)
      .eq("table_key", tableKey)
      .eq("row_pk", rowPk)
      .maybeSingle();

    // A sandbox-only row (never real) being deleted just disappears —
    // leaving a delete-tombstone would point at a row that never existed.
    if (existing?.op === "insert") {
      const { error } = await client
        .from(table("sandboxOverlay"))
        .delete()
        .eq("owner_net_id", ownerNetId)
        .eq("table_key", tableKey)
        .eq("row_pk", rowPk);
      if (error) throw new Error(`sandboxWrite: ${error.message}`);
      return;
    }
  }

  const { error } = await client.from(table("sandboxOverlay")).upsert(
    {
      owner_net_id: ownerNetId,
      table_key: tableKey,
      row_pk: rowPk,
      op,
      row_data: op === "delete" ? null : rowData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_net_id,table_key,row_pk" }
  );
  if (error) throw new Error(`sandboxWrite: ${error.message}`);
}

/** Clears a user's sandbox overlay — one table, or all of them if tableKey is omitted. */
export async function resetSandbox(ownerNetId, tableKey) {
  let q = getSupabaseServer().from(table("sandboxOverlay")).delete().eq("owner_net_id", ownerNetId);
  if (tableKey) q = q.eq("table_key", tableKey);
  const { error } = await q;
  if (error) throw new Error(`resetSandbox: ${error.message}`);
}
