import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";
import { canManageCheckSubmission } from "../../../../lib/sprintCheckAccess";
import { forbidden, invalidInput, serverError, signInRequired } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

// Grades an understanding-check submission. Submissions are stored as
// action_items rows (see app/api/sprints/[id]/check/submit/route.js); the
// manual action-item assignment feature that once shared this table is gone,
// so grading is the only write this route still accepts.
export async function PATCH(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }
  if (userRole === "student") {
    return forbidden();
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidInput();
  if (body.grade === undefined) {
    return NextResponse.json({ error: "Please provide at least one field to change." }, { status: 400 });
  }
  if (body.grade_note != null && typeof body.grade_note !== "string") return NextResponse.json({ error: "Feedback must be text" }, { status: 400 });

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off";
  const { data: realItem } = await supabaseServer.from(table("actionItems")).select("*").eq("id", id).maybeSingle();
  const item = sandboxed ? await getEffectiveRow(netID, "actionItems", id, realItem) : realItem;
  if (!item) return NextResponse.json({ error: "We could not find that item." }, { status: 404 });
  if (!item.sprint_id || !item.is_gradable) {
    return NextResponse.json({ error: "This work item does not accept a grade." }, { status: 400 });
  }
  if (!item.is_done) {
    return NextResponse.json({ error: "Mark the work complete before entering a grade." }, { status: 400 });
  }
  // Graded by the student's group (their PM) or a course manager - not by
  // whoever happened to open the check window.
  if (!(await canManageCheckSubmission(userRole, netID, item.net_id))) {
    return NextResponse.json({ error: "Only this student's PM or course staff can grade their understanding check." }, { status: 403 });
  }

  const updates = {};
  if (body.grade === null) {
    updates.grade = null;
    updates.grade_note = null;
    updates.graded_by = null;
    updates.graded_at = null;
  } else {
    const g = Number(body.grade);
    if (!["number", "string"].includes(typeof body.grade) || String(body.grade).trim() === "" || !Number.isFinite(g) || g < 0) {
      return NextResponse.json({ error: "Enter a grade of 0 or higher." }, { status: 400 });
    }
    if (item.max_score != null && g > item.max_score) {
      return NextResponse.json({ error: `Grade cannot exceed ${item.max_score}` }, { status: 400 });
    }
    updates.grade = g;
    updates.graded_by = netID;
    updates.graded_at = new Date().toISOString();
    if (body.grade_note !== undefined) updates.grade_note = body.grade_note?.trim() || null;
  }

  if (sandboxed) {
    const merged = { ...item, ...updates };
    await sandboxWrite(netID, "actionItems", "update", id, merged);
    return NextResponse.json(merged);
  }

  // Only write if the item is still in the state that was validated above.
  let query = supabaseServer.from(table("actionItems")).update(updates).eq("id", id)
    .eq("is_done", true).eq("is_gradable", true);
  query = item.max_score == null ? query.is("max_score", null) : query.eq("max_score", item.max_score);
  const { data, error } = await query.select().maybeSingle();
  if (error) return serverError();
  if (!data) return NextResponse.json({ error: "Item changed or is no longer available; reload and retry" }, { status: 409 });
  return NextResponse.json(data);
}
