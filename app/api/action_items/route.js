import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY } from "../../../lib/roles";

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
  return NextResponse.json(data);
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

  // A PM may only ever act within their own group — fetch once, used by both
  // the "individual" and "group" target paths below.
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

    const { data: targetUsers, error: targetErr } = await supabaseServer
      .from(table("users"))
      .select("net_id, role, group_number")
      .in("net_id", cleanIds);
    if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 500 });

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

    let roleQuery = supabaseServer.from(table("users")).select("net_id").eq("role", role);
    if (userRole === "pm") roleQuery = roleQuery.eq("group_number", requesterGroup);
    const { data: roleUsers, error: roleErr } = await roleQuery;

    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });
    targetNetIds = (roleUsers || []).map((u) => u.net_id);
  } else if (target_type === "group") {
    if (!target_group) return NextResponse.json({ error: "target_group required" }, { status: 400 });
    if (userRole === "pm" && (requesterGroup == null || Number(target_group) !== requesterGroup)) {
      return NextResponse.json({ error: "You can only assign to your own group" }, { status: 403 });
    }

    const { data: groupUsers, error: groupErr } = await supabaseServer
      .from(table("users"))
      .select("net_id")
      .eq("group_number", Number(target_group))
      .eq("role", "STUDENT");

    if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });
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

  const { data, error } = await supabaseServer.from(table("actionItems")).insert(records).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: targetNetIds.length, batch_id: batchId, data }, { status: 201 });
}
