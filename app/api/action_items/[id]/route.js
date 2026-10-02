import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";
import { canManageCheckSubmission } from "../../../../lib/sprintCheckAccess";

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please check the information you entered and try again." }, { status: 400 });
  if (["is_done", "is_gradable"].some((key) => body[key] !== undefined && typeof body[key] !== "boolean")) {
    return NextResponse.json({ error: "Completion and grading options must be selected as yes or no." }, { status: 400 });
  }
  if (body.grade_note != null && typeof body.grade_note !== "string") return NextResponse.json({ error: "Feedback must be text" }, { status: 400 });
  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) return NextResponse.json({ error: "Please enter a title." }, { status: 400 });
  const updates = {};
  let gradingSnapshot = null;

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off";
  // Fetched once, up front, for sandboxed callers - used both for the grade
  // validation below and as the merge base when writing the overlay update
  // at the end. Never fetched for non-sandboxed callers (zero extra cost).
  let effectiveItem = null;
  if (sandboxed) {
    const { data: realItem } = await supabaseServer.from(table("actionItems")).select("*").eq("id", id).maybeSingle();
    effectiveItem = await getEffectiveRow(netID, "actionItems", id, realItem);
  }

  if (body.is_done !== undefined) {
    if (userRole !== "student" && !sandboxed) {
      const { data: current } = await supabaseServer.from(table("actionItems")).select("net_id").eq("id", id).maybeSingle();
      if (current?.net_id !== netID && !(await canManageItem(userRole, netID, id))) {
        return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
      }
    }
    updates.is_done = body.is_done;
    updates.completion_date = body.is_done ? new Date().toISOString() : null;
    if (!body.is_done) {
      // Reopening resets any existing grade - the work is changing, so it needs a re-review.
      updates.grade = null;
      updates.grade_note = null;
      updates.graded_by = null;
      updates.graded_at = null;
    }
  }

  // Content edits (title / description / due_date / is_gradable / max_score) require management authority
  const isContentEdit =
    body.title !== undefined ||
    body.description !== undefined ||
    body.due_date !== undefined ||
    body.is_gradable !== undefined ||
    body.max_score !== undefined;

  if (isContentEdit) {
    if (userRole === "student") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
    }
    const allowed = await canManageItem(userRole, netID, id);
    if (!allowed) {
      return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
    }
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Please enter a title." }, { status: 400 });
      updates.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (body.description != null && typeof body.description !== "string") return NextResponse.json({ error: "Please enter the description as text." }, { status: 400 });
      updates.description = body.description?.trim() || null;
    }
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.is_gradable !== undefined) {
      updates.is_gradable = !!body.is_gradable;
      if (!body.is_gradable) {
        updates.max_score = null;
        updates.grade = null;
        updates.grade_note = null;
        updates.graded_by = null;
        updates.graded_at = null;
      }
    }
    if (body.max_score !== undefined) {
      const parsed = Number(body.max_score);
      if (body.is_gradable !== false && (!Number.isFinite(parsed) || parsed <= 0)) {
        return NextResponse.json({ error: "Maximum score must be a positive number" }, { status: 400 });
      }
      updates.max_score = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  // Grading is a separate authority: only the person who assigned the item can grade it.
  if (body.grade !== undefined) {
    if (userRole === "student") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
    }
    const item = sandboxed
      ? effectiveItem
      : (await supabaseServer.from(table("actionItems")).select("net_id, sprint_id, is_gradable, is_done, assigned_by, max_score").eq("id", id).maybeSingle()).data;
    if (!item) return NextResponse.json({ error: "We could not find that item." }, { status: 404 });
    gradingSnapshot = item;
    if (!(updates.is_gradable ?? item.is_gradable)) {
      return NextResponse.json({ error: "This work item does not accept a grade." }, { status: 400 });
    }
    if (!(updates.is_done ?? item.is_done)) {
      return NextResponse.json({ error: "Mark the work complete before entering a grade." }, { status: 400 });
    }
    // Understanding checks are graded by the student's group (their PM) or a
    // course manager - not by whoever happened to open the check window.
    if (item.sprint_id) {
      if (!(await canManageCheckSubmission(userRole, netID, item.net_id))) {
        return NextResponse.json({ error: "Only this student's PM or course staff can grade their understanding check." }, { status: 403 });
      }
    } else if (item.assigned_by !== netID) {
      return NextResponse.json({ error: "Only the person who assigned this work can grade it." }, { status: 403 });
    }

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
      const maxScore = updates.max_score !== undefined ? updates.max_score : item.max_score;
      if (maxScore != null && g > maxScore) {
        return NextResponse.json({ error: `Grade cannot exceed ${maxScore}` }, { status: 400 });
      }
      updates.grade = g;
      updates.graded_by = netID;
      updates.graded_at = new Date().toISOString();
    }
    if (body.grade !== null && body.grade_note !== undefined) updates.grade_note = body.grade_note?.trim() || null;
  }

  if (body.max_score !== undefined && body.is_gradable !== false) {
    const current = sandboxed ? effectiveItem : (await supabaseServer.from(table("actionItems")).select("grade, is_gradable").eq("id", id).maybeSingle()).data;
    const nextGrade = updates.grade !== undefined ? updates.grade : current?.grade;
    if (updates.max_score != null && nextGrade != null && nextGrade > updates.max_score) {
      return NextResponse.json({ error: "The maximum score cannot be lower than the current grade." }, { status: 400 });
    }
  }
  if (updates.is_gradable === false) updates.max_score = null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Please provide at least one field to change." }, { status: 400 });
  }

  if (sandboxed) {
    // effectiveItem was already resolved above - students are never
    // sandboxed, so the net_id-scoping the real path needs doesn't apply.
    if (!effectiveItem) return NextResponse.json({ error: "We could not find that item." }, { status: 404 });
    const merged = { ...effectiveItem, ...updates };
    await sandboxWrite(netID, "actionItems", "update", id, merged);
    return NextResponse.json(merged);
  }

  let query = supabaseServer.from(table("actionItems")).update(updates).eq("id", id);
  if (userRole === "student") {
    query = query.eq("net_id", netID);
  }

  if (gradingSnapshot) {
    if (!gradingSnapshot.sprint_id) query = query.eq("assigned_by", netID);
    query = query.eq("is_done", gradingSnapshot.is_done).eq("is_gradable", gradingSnapshot.is_gradable);
    query = gradingSnapshot.max_score == null ? query.is("max_score", null) : query.eq("max_score", gradingSnapshot.max_score);
  }
  const { data, error } = await query.select().maybeSingle();
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Item changed or is no longer available; reload and retry" }, { status: 409 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await canManageItem(userRole, netID, id);
  if (!allowed) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    await sandboxWrite(netID, "actionItems", "delete", id, null);
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseServer.from(table("actionItems")).delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Authorization helper ─────────────────────────────────────────────────────

/**
 * Returns true if the requesting user has authority to edit/delete this item.
 *
 * course_lead  - can manage items for anyone
 * head_pm      - can manage items assigned to PMs or students
 * pm           - can manage items assigned to students in their own group
 * Understanding-check submissions: course managers, or the student's own PM.
 */
const FULL_ITEM_ACCESS = ["course_lead", "lead_web_dev", "web_dev"];

export async function canManageItem(userRole, netID, itemId) {
  // Fetch the item to find the recipient
  const { data: item } = await supabaseServer
    .from(table("actionItems"))
    .select("net_id, sprint_id")
    .eq("id", itemId)
    .maybeSingle();
  // Understanding-check submissions are scoped by group for every role,
  // including web devs acting as PMs.
  if (item?.sprint_id) return canManageCheckSubmission(userRole, netID, item.net_id);
  if (FULL_ITEM_ACCESS.includes(userRole)) return true;
  if (!item) return false;

  // Fetch the recipient's role and group
  const { data: recipient } = await supabaseServer
    .from(table("users"))
    .select("role, group_number")
    .eq("net_id", item.net_id)
    .maybeSingle();
  if (!recipient) return false;

  if (userRole === "head_pm") {
    return ["PM", "STUDENT"].includes(recipient.role);
  }

  if (userRole === "pm") {
    if (recipient.role !== "STUDENT") return false;
    // Recipient must be in the PM's own group
    const { data: pmRecord } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", netID)
      .maybeSingle();
    return (
      pmRecord?.group_number != null &&
      pmRecord.group_number === recipient.group_number
    );
  }

  return false;
}
