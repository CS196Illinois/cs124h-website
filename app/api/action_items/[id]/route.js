import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates = {};

  if (body.is_done !== undefined) {
    updates.is_done = body.is_done;
    updates.completion_date = body.is_done ? new Date().toISOString() : null;
    if (!body.is_done) {
      // Reopening resets any existing grade — the work is changing, so it needs a re-review.
      updates.grade = null;
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const allowed = await canManageItem(userRole, netID, id);
    if (!allowed) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.is_gradable !== undefined) {
      updates.is_gradable = !!body.is_gradable;
      if (!body.is_gradable) {
        updates.max_score = null;
        updates.grade = null;
        updates.graded_by = null;
        updates.graded_at = null;
      }
    }
    if (body.max_score !== undefined) {
      const parsed = Number(body.max_score);
      updates.max_score = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  // Grading is a separate authority: only the person who assigned the item can grade it.
  if (body.grade !== undefined) {
    if (userRole === "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { data: item } = await supabaseServer
      .from(table("actionItems"))
      .select("is_gradable, is_done, assigned_by, max_score")
      .eq("id", id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!item.is_gradable) {
      return NextResponse.json({ error: "This item is not gradable" }, { status: 400 });
    }
    if (!item.is_done) {
      return NextResponse.json({ error: "Item must be completed before it can be graded" }, { status: 400 });
    }
    if (item.assigned_by !== netID) {
      return NextResponse.json({ error: "Only the person who assigned this item can grade it" }, { status: 403 });
    }

    if (body.grade === null) {
      updates.grade = null;
      updates.graded_by = null;
      updates.graded_at = null;
    } else {
      const g = Number(body.grade);
      if (!Number.isFinite(g) || g < 0) {
        return NextResponse.json({ error: "Grade must be a non-negative number" }, { status: 400 });
      }
      if (item.max_score != null && g > item.max_score) {
        return NextResponse.json({ error: `Grade cannot exceed ${item.max_score}` }, { status: 400 });
      }
      updates.grade = g;
      updates.graded_by = netID;
      updates.graded_at = new Date().toISOString();
    }
    if (body.grade_note !== undefined) updates.grade_note = body.grade_note?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  let query = supabaseServer.from(table("actionItems")).update(updates).eq("id", id);
  if (userRole === "student") {
    query = query.eq("net_id", netID);
  }

  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await canManageItem(userRole, netID, id);
  if (!allowed) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { error } = await supabaseServer.from(table("actionItems")).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Authorization helper ─────────────────────────────────────────────────────

/**
 * Returns true if the requesting user has authority to edit/delete this item.
 *
 * course_lead  - can manage items for anyone
 * head_pm      - can manage items assigned to PMs or students
 * pm           - can manage items assigned to students in their own group
 */
const FULL_ITEM_ACCESS = ["course_lead", "lead_web_dev", "web_dev"];

async function canManageItem(userRole, netID, itemId) {
  if (FULL_ITEM_ACCESS.includes(userRole)) return true;

  // Fetch the item to find the recipient
  const { data: item } = await supabaseServer
    .from(table("actionItems"))
    .select("net_id")
    .eq("id", itemId)
    .maybeSingle();
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
