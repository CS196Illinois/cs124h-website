import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { canManageItem } from "../../[id]/route";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../../../lib/sandbox";
import { manageableCheckStudents } from "../../../../../lib/sprintCheckAccess";

// A sprint's understanding-check submissions share the sprint id as their
// batch_id across every group. For those, a caller acts only on the
// submissions they manage (a PM: their own group), never the whole batch.
async function scopeCheckBatch(items, userRole, netID) {
  if (!items.length || !items.every((item) => item.sprint_id)) return { isCheckBatch: false, items };
  const allowed = await manageableCheckStudents(userRole, netID, items.map((item) => item.net_id));
  return { isCheckBatch: true, items: items.filter((item) => allowed.has(item.net_id)) };
}

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
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { batchId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Please check the information you entered and try again." }, { status: 400 });
  const entries = Array.isArray(body.grades) ? body.grades : [];
  if (entries.length === 0) {
    return NextResponse.json({ error: "Please enter at least one grade." }, { status: 400 });
  }

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off";

  const { data: realItems, error: fetchErr } = await supabaseServer
    .from(table("actionItems"))
    .select("*")
    .eq("batch_id", batchId);
  if (fetchErr) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  let items = realItems;
  if (sandboxed) {
    items = await mergeSandboxRows(netID, "actionItems", realItems, (row) => row.batch_id === batchId);
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "That group of assignments could not be found." }, { status: 404 });
  }
  const scoped = await scopeCheckBatch(items, userRole, netID);
  items = scoped.items;
  if (scoped.isCheckBatch && items.length === 0) {
    return NextResponse.json({ error: "Only a student's PM or course staff can grade their understanding check." }, { status: 403 });
  }
  if (!scoped.isCheckBatch && items.some((item) => item.assigned_by !== netID)) {
    return NextResponse.json({ error: "Only the person who assigned this work can grade it." }, { status: 403 });
  }

  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const updates = [];
  const skipped = [];

  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || seen.has(entry.id)) return NextResponse.json({ error: "Each grade must identify a unique item" }, { status: 400 });
    seen.add(entry.id);
    if (entry.grade_note != null && typeof entry.grade_note !== "string") return NextResponse.json({ error: "Feedback must be text" }, { status: 400 });
    const item = itemsById[entry.id];
    if (!item) { skipped.push({ id: entry.id, reason: "Not part of this batch" }); continue; }
    if (!item.is_gradable) { skipped.push({ id: entry.id, reason: "Not gradable" }); continue; }
    if (!item.is_done) { skipped.push({ id: entry.id, reason: "Not completed yet" }); continue; }

    // Supabase's .upsert() builds an INSERT ... ON CONFLICT DO UPDATE - Postgres
    // validates NOT NULL constraints against the row as if it were being
    // inserted even when the conflict path will actually just update it, so
    // every NOT NULL column without a default (net_id, title) must be present
    // in the payload even though we only ever intend to hit existing rows.
    if (entry.grade === null) {
      updates.push({ id: entry.id, net_id: item.net_id, title: item.title, grade: null, grade_note: null, graded_by: null, graded_at: null });
      continue;
    }

    const g = Number(entry.grade);
    if (!["number", "string"].includes(typeof entry.grade) || String(entry.grade).trim() === "" || !Number.isFinite(g) || g < 0) { skipped.push({ id: entry.id, reason: "Invalid grade" }); continue; }
    if (item.max_score != null && g > item.max_score) { skipped.push({ id: entry.id, reason: `Exceeds ${item.max_score}` }); continue; }

    updates.push({
      id: entry.id,
      net_id: item.net_id,
      title: item.title,
      grade: g,
      graded_by: netID,
      graded_at: new Date().toISOString(),
      grade_note: entry.grade_note !== undefined ? entry.grade_note?.trim() || null : item.grade_note,
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid grades to apply", skipped }, { status: 400 });
  }

  let data;
  if (sandboxed) {
    const mergedRows = updates.map((u) => ({ ...itemsById[u.id], ...u }));
    await Promise.all(mergedRows.map((row) => sandboxWrite(netID, "actionItems", "update", row.id, row)));
    data = mergedRows;
  } else {
    // Update existing rows only: an upsert could resurrect an item deleted
    // while this request was validating it. Check the grading state again
    // at write time so a concurrent reopen cannot acquire a stale grade.
    data = [];
    for (const update of updates) {
      const item = itemsById[update.id];
      const { id, net_id, title, ...gradeFields } = update;
      let query = supabaseServer.from(table("actionItems")).update(gradeFields)
        .eq("id", id).eq("batch_id", batchId)
        .eq("is_done", true).eq("is_gradable", true);
      if (!scoped.isCheckBatch) query = query.eq("assigned_by", netID);
      query = item.max_score == null ? query.is("max_score", null) : query.eq("max_score", item.max_score);
      const { data: saved, error } = await query.select().maybeSingle();
      if (error) skipped.push({ id, reason: "Could not save this grade; retry" });
      else if (!saved) skipped.push({ id, reason: "Item changed while saving; reload and retry" });
      else data.push(saved);
    }
  }

  return NextResponse.json({ success: true, updated: data.length, skipped, data });
}

/**
 * Delete every item in a batch at once. Uses the same per-recipient
 * authority check as deleting a single item (canManageItem), not the
 * assigner-only rule PATCH uses above - a course_lead deleting a PM's
 * batch, or a head_pm deleting one assigned to their students, is exactly
 * as valid as deleting those items one at a time already was.
 */
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { batchId } = await params;
  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off";

  const { data: realItems, error: fetchErr } = await supabaseServer
    .from(table("actionItems"))
    .select("id, net_id, sprint_id")
    .eq("batch_id", batchId);
  if (fetchErr) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  let items = realItems;
  if (sandboxed) {
    items = await mergeSandboxRows(netID, "actionItems", realItems, (row) => row.batch_id === batchId);
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "That group of assignments could not be found." }, { status: 404 });
  }
  const scoped = await scopeCheckBatch(items, userRole, netID);
  if (scoped.isCheckBatch) {
    items = scoped.items;
    if (items.length === 0) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  for (const item of items) {
    if (!(await canManageItem(userRole, netID, item.id))) {
      return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
    }
  }

  if (sandboxed) {
    await Promise.all(items.map((item) => sandboxWrite(netID, "actionItems", "delete", String(item.id), null)));
    return NextResponse.json({ success: true, count: items.length });
  }

  let deletion = supabaseServer.from(table("actionItems")).delete().eq("batch_id", batchId);
  if (scoped.isCheckBatch) deletion = deletion.in("id", items.map((item) => item.id));
  const { error } = await deletion;
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  return NextResponse.json({ success: true, count: items.length });
}
