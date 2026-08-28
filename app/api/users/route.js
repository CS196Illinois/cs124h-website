import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY as MANAGEABLE_ROLES } from "../../../lib/roles";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, getEffectiveRow, sandboxWrite, resetSandbox } from "../../../lib/sandbox";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role");
  const groupFilter = searchParams.get("group");

  let query = supabaseServer.from(table("users")).select("*").order("net_id");

  if (roleFilter) query = query.eq("role", roleFilter);
  if (groupFilter) query = query.eq("group_number", Number(groupFilter));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const matchesFilter = (row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      if (groupFilter && row.group_number !== Number(groupFilter)) return false;
      return true;
    };
    rows = await mergeSandboxRows(netID, "users", rows, matchesFilter);
    rows.sort((a, b) => (a.net_id < b.net_id ? -1 : a.net_id > b.net_id ? 1 : 0));
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = MANAGEABLE_ROLES[userRole];
  if (!allowed) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { net_id, role, name, group_number } = body;

  if (!net_id || !role) {
    return NextResponse.json({ error: "net_id and role are required" }, { status: 400 });
  }

  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "You cannot add users with that role" }, { status: 403 });
  }

  const cleanNetId = net_id.trim().toLowerCase();

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("users")).select("*").eq("net_id", cleanNetId).maybeSingle();
    const existing = await getEffectiveRow(netID, "users", cleanNetId, realRow);
    if (existing) {
      return NextResponse.json({ error: `duplicate key value violates unique constraint "user-testing_pkey"` }, { status: 500 });
    }
    const fullRow = {
      net_id: cleanNetId, role, name: name?.trim() || null, group_number: group_number || null,
      sub: null, discord_user_id: null, sandbox_mode: "off",
    };
    await sandboxWrite(netID, "users", "insert", cleanNetId, fullRow);
    return NextResponse.json(fullRow, { status: 201 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .insert({ net_id: cleanNetId, role, name: name?.trim() || null, group_number: group_number || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

const BULK_DELETE_ROLES = ["course_lead", "lead_web_dev", "web_dev"];

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!BULK_DELETE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  const VALID_ROLES = ["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"];
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "A valid role query param is required" }, { status: 400 });
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRows } = await supabaseServer.from(table("users")).select("net_id").eq("role", role);
    const merged = await mergeSandboxRows(netID, "users", realRows ?? [], (row) => row.role === role);
    await Promise.all(merged.map((u) => sandboxWrite(netID, "users", "delete", u.net_id, null)));
    return NextResponse.json({ deleted: merged.length });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .delete()
    .eq("role", role)
    .select("net_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hygiene, not a security requirement (a deleted user can never reach a
  // sandboxed route again either way) - avoid leaving orphaned overlay rows
  // behind for a whole bulk-deleted role.
  if (role === "WEB" || role === "LEAD_WEB") {
    await Promise.all(data.map((u) => resetSandbox(u.net_id)));
  }

  return NextResponse.json({ deleted: data.length });
}
