import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { canManageItem } from "../../[id]/route";

/**
 * Bulk-grade every eligible item in a batch (a set of action items created
 * together for multiple recipients) in one request, instead of the caller
 * having to PATCH each item individually.
 */
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await params;
  const body = await request.json();
  const entries = Array.isArray(body.grades) ? body.grades : [];
  if (entries.length === 0) {
    return NextResponse.json({ error: "No grades provided" }, { status: 400 });
  }

  const { data: items, error: fetchErr } = await supabaseServer
    .from(table("actionItems"))
    .select("id, net_id, title, is_gradable, is_done, assigned_by, max_score")
    .eq("batch_id", batchId);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (items.some((item) => item.assigned_by !== netID)) {
    return NextResponse.json({ error: "Only the person who assigned this batch can grade it" }, { status: 403 });
  }

  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const updates = [];
  const skipped = [];

  for (const entry of entries) {
    const item = itemsById[entry.id];
    if (!item) { skipped.push({ id: entry.id, reason: "Not part of this batch" }); continue; }
    if (!item.is_gradable) { skipped.push({ id: entry.id, reason: "Not gradable" }); continue; }
    if (!item.is_done) { skipped.push({ id: entry.id, reason: "Not completed yet" }); continue; }

    // Supabase's .upsert() builds an INSERT ... ON CONFLICT DO UPDATE — Postgres
    // validates NOT NULL constraints against the row as if it were being
    // inserted even when the conflict path will actually just update it, so
    // every NOT NULL column without a default (net_id, title) must be present
    // in the payload even though we only ever intend to hit existing rows.
    if (entry.grade === null) {
      updates.push({ id: entry.id, net_id: item.net_id, title: item.title, grade: null, graded_by: null, graded_at: null });
      continue;
    }

    const g = Number(entry.grade);
    if (!Number.isFinite(g) || g < 0) { skipped.push({ id: entry.id, reason: "Invalid grade" }); continue; }
    if (item.max_score != null && g > item.max_score) { skipped.push({ id: entry.id, reason: `Exceeds ${item.max_score}` }); continue; }

    updates.push({
      id: entry.id,
      net_id: item.net_id,
      title: item.title,
      grade: g,
      graded_by: netID,
      graded_at: new Date().toISOString(),
      ...(entry.grade_note !== undefined && { grade_note: entry.grade_note?.trim() || null }),
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid grades to apply", skipped }, { status: 400 });
  }

  const { data, error } = await supabaseServer.from(table("actionItems")).upsert(updates).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, updated: data.length, skipped, data });
}

/**
 * Delete every item in a batch at once. Uses the same per-recipient
 * authority check as deleting a single item (canManageItem), not the
 * assigner-only rule PATCH uses above — a course_lead deleting a PM's
 * batch, or a head_pm deleting one assigned to their students, is exactly
 * as valid as deleting those items one at a time already was.
 */
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await params;

  const { data: items, error: fetchErr } = await supabaseServer
    .from(table("actionItems"))
    .select("id")
    .eq("batch_id", batchId);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  for (const item of items) {
    if (!(await canManageItem(userRole, netID, item.id))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }

  const { error } = await supabaseServer.from(table("actionItems")).delete().eq("batch_id", batchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: items.length });
}
