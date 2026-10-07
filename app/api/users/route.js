import { NextResponse, after } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY as MANAGEABLE_ROLES, WEB_TEAM_ROLE_IDS, DEFAULT_WEB_SANDBOX_MODE } from "../../../lib/roles";
import { parseGroupNumber } from "../../../lib/fieldRules";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, getEffectiveRow, sandboxWrite, resetSandbox } from "../../../lib/sandbox";
import { syncSheetAccessForRole, SHEET_ACCESS_ROLES } from "../../../lib/sheetAccess";
import { forbidden, serverError, signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";

export async function GET(request) {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role");
  const groupFilter = searchParams.get("group");

  let query = supabaseServer.from(table("users")).select("*").order("net_id");

  if (roleFilter) query = query.eq("role", roleFilter);
  if (groupFilter) query = query.eq("group_number", Number(groupFilter));

  const { data, error } = await query;
  if (error) return serverError();

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
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const allowed = MANAGEABLE_ROLES[userRole];
  if (!allowed) {
    return forbidden();
  }

  const body = await request.json();
  const { net_id, role, name, group_number } = body;

  if (typeof net_id !== "string" || !net_id.trim() || !role) {
    return NextResponse.json({ error: "Please enter both a NetID and a role." }, { status: 400 });
  }
  if (name != null && typeof name !== "string") {
    return NextResponse.json({ error: "Please enter the name as text." }, { status: 400 });
  }
  const group = parseGroupNumber(group_number);
  if (group.error) return NextResponse.json({ error: group.error }, { status: 400 });

  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "You cannot add users with that role" }, { status: 403 });
  }

  const cleanNetId = net_id.trim().toLowerCase();

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("users")).select("*").eq("net_id", cleanNetId).maybeSingle();
    const existing = await getEffectiveRow(netID, "users", cleanNetId, realRow);
    if (existing) {
      return NextResponse.json({ error: `A user with NetID "${cleanNetId}" already exists.` }, { status: 409 });
    }
    const fullRow = {
      net_id: cleanNetId, role, name: name?.trim() || null, group_number: group.value,
      sub: null, discord_user_id: null, sandbox_mode: "off",
    };
    await sandboxWrite(netID, "users", "insert", cleanNetId, fullRow);
    return NextResponse.json(fullRow, { status: 201 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .insert({
      net_id: cleanNetId, role, name: name?.trim() || null, group_number: group.value,
      ...(WEB_TEAM_ROLE_IDS.includes(role) && { sandbox_mode: DEFAULT_WEB_SANDBOX_MODE }),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `A user with NetID "${cleanNetId}" already exists.` }, { status: 409 });
    }
    return serverError();
  }

  if (SHEET_ACCESS_ROLES.has(role)) {
    after(() => syncSheetAccessForRole(cleanNetId, role).catch((e) => console.error(`sheet access sync failed for ${cleanNetId}:`, e.message)));
  }

  return NextResponse.json(data, { status: 201 });
}

const BULK_DELETE_ROLES = ["course_lead", "lead_web_dev", "web_dev"];

export async function DELETE(request) {
  const { role: userRole, netID } = await getSessionUser();
  if (!BULK_DELETE_ROLES.includes(userRole)) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  const VALID_ROLES = ["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"];
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Please choose a valid role." }, { status: 400 });
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

  if (error) return serverError();

  // Hygiene, not a security requirement (a deleted user can never reach a
  // sandboxed route again either way) - avoid leaving orphaned overlay rows
  // behind for a whole bulk-deleted role.
  if (role === "WEB" || role === "LEAD_WEB") {
    await Promise.all(data.map((u) => resetSandbox(u.net_id)));
  }

  if (SHEET_ACCESS_ROLES.has(role)) {
    after(() => Promise.all(
      data.map((u) => syncSheetAccessForRole(u.net_id, null).catch((e) => console.error(`sheet access revoke failed for ${u.net_id}:`, e.message)))
    ));
  }

  return NextResponse.json({ deleted: data.length });
}
