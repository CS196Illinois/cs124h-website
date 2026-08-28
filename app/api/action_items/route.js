import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY } from "../../../lib/roles";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../lib/sandbox";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  // scope=mine (default): items assigned to me OR assigned by me
  // scope=all: full management scope (students/web_devs are always "mine" regardless)
  const scope = searchParams.get("scope") || "mine";

  let query = supabaseServer
    .from(table("actionItems"))
    .select("*")
    .order("created_at", { ascending: false });

  if (userRole === "student") {
    // Always own items only, regardless of scope
    query = query.eq("net_id", netID);
  } else if (scope === "mine") {
    // Items assigned to me OR that I assigned to others
    query = query.or(`net_id.eq.${netID},assigned_by.eq.${netID}`);
  }
  // scope=all for management: no additional filter (returns everything)

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const matchesFilter = scope === "mine"
      ? (row) => row.net_id === netID || row.assigned_by === netID
      : () => true;
    rows = await mergeSandboxRows(netID, "actionItems", rows, matchesFilter);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const assignerNetID = session?.user?.netID;

  if (!userRole || userRole === "student" || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, due_date, target_type, target_net_ids, target_net_id, target_group, is_gradable, max_score } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  let gradable = false;
  let maxScore = null;
  if (is_gradable) {
    gradable = true;
    const parsed = Number(max_score);
    maxScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  }

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(assignerNetID)) !== "off";

  // A PM may only ever act within their own group - fetch once, used by both
  // the "individual" and "group" target paths below. PM is never a
  // sandboxable role, so this read is always real.
  let requesterGroup = null;
  if (userRole === "pm") {
    const { data: me } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", assignerNetID)
      .maybeSingle();
    requesterGroup = me?.group_number ?? null;
  }

  let targetNetIds = [];

  if (target_type === "individual") {
    const rawIds = Array.isArray(target_net_ids) ? target_net_ids : (target_net_id ? [target_net_id] : []);
    const cleanIds = [...new Set(rawIds.map((id) => id?.trim().toLowerCase()).filter(Boolean))];
    if (cleanIds.length === 0) {
      return NextResponse.json({ error: "Select at least one person" }, { status: 400 });
    }

    const { data: realTargetUsers, error: targetErr } = await supabaseServer
      .from(table("users"))
      .select("net_id, role, group_number")
      .in("net_id", cleanIds);
    if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 500 });

    const targetUsers = sandboxed
      ? await mergeSandboxRows(assignerNetID, "users", realTargetUsers, (row) => cleanIds.includes(row.net_id))
      : realTargetUsers;

    const manageableRoles = MANAGEABLE_BY[userRole] || [];
    for (const id of cleanIds) {
      const u = targetUsers.find((t) => t.net_id === id);
      if (!u || !manageableRoles.includes(u.role)) {
        return NextResponse.json({ error: `You don't have permission to assign items to ${id}` }, { status: 403 });
      }
      if (userRole === "pm" && u.group_number !== requesterGroup) {
        return NextResponse.json({ error: `${id} is not in your group` }, { status: 403 });
      }
    }
    targetNetIds = cleanIds;
  } else if (target_type.startsWith("role_")) {
    const role = target_type.replace("role_", "");

    // Enforce hierarchy
    if (userRole === "head_pm" && !["PM", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    if (userRole === "pm" && role !== "STUDENT") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let roleQuery = supabaseServer.from(table("users")).select("net_id, role, group_number").eq("role", role);
    if (userRole === "pm") roleQuery = roleQuery.eq("group_number", requesterGroup);
    const { data: realRoleUsers, error: roleErr } = await roleQuery;
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

    const roleUsers = sandboxed
      ? await mergeSandboxRows(assignerNetID, "users", realRoleUsers, (row) => row.role === role && (userRole !== "pm" || row.group_number === requesterGroup))
      : realRoleUsers;
    targetNetIds = (roleUsers || []).map((u) => u.net_id);
  } else if (target_type === "group") {
    if (!target_group) return NextResponse.json({ error: "target_group required" }, { status: 400 });
    if (userRole === "pm" && (requesterGroup == null || Number(target_group) !== requesterGroup)) {
      return NextResponse.json({ error: "You can only assign to your own group" }, { status: 403 });
    }

    const { data: realGroupUsers, error: groupErr } = await supabaseServer
      .from(table("users"))
      .select("net_id, role, group_number")
      .eq("group_number", Number(target_group))
      .eq("role", "STUDENT");
    if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });

    const groupUsers = sandboxed
      ? await mergeSandboxRows(assignerNetID, "users", realGroupUsers, (row) => row.group_number === Number(target_group) && row.role === "STUDENT")
      : realGroupUsers;
    targetNetIds = (groupUsers || []).map((u) => u.net_id);
  }

  if (targetNetIds.length === 0) {
    return NextResponse.json({ error: "No matching users found for target" }, { status: 400 });
  }

  // Bulk assignments (more than one recipient) share a batch_id so the assigner
  // can later grade/review the whole batch as one unit instead of N separate items.
  const batchId = targetNetIds.length > 1 ? randomUUID() : null;

  const records = targetNetIds.map((net_id) => ({
    net_id,
    assigned_by: assignerNetID,
    title: title.trim(),
    description: description?.trim() || null,
    due_date: due_date || null,
    is_gradable: gradable,
    max_score: maxScore,
    batch_id: batchId,
    additional_info: { assigned_by: assignerNetID }, // keep for backward compat
  }));

  if (sandboxed) {
    const now = new Date().toISOString();
    const fullRows = records.map((r) => ({
      id: randomUUID(),
      created_at: now,
      is_done: false,
      completion_date: null,
      grade: null,
      grade_note: null,
      graded_by: null,
      graded_at: null,
      ...r,
    }));
    await Promise.all(fullRows.map((row) => sandboxWrite(assignerNetID, "actionItems", "insert", row.id, row)));
    return NextResponse.json({ success: true, count: targetNetIds.length, batch_id: batchId, data: fullRows }, { status: 201 });
  }

  const { data, error } = await supabaseServer.from(table("actionItems")).insert(records).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: targetNetIds.length, batch_id: batchId, data }, { status: 201 });
}
