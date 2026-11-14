import { NextResponse, after } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY as MANAGEABLE_ROLES, ROLES_BY_ID } from "../../../lib/roles";
import { parseGroupNumber } from "../../../lib/fieldRules";
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

  return NextResponse.json(data);
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please enter both a NetID and a role." }, { status: 400 });
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

  const { data, error } = await supabaseServer
    .from(table("users"))
    .insert({
      net_id: cleanNetId, role, name: name?.trim() || null, group_number: group.value,
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

const BULK_DELETE_ROLES = ["course_lead"];

export async function DELETE(request) {
  const { role: userRole, netID } = await getSessionUser();
  if (!BULK_DELETE_ROLES.includes(userRole)) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (!role || !ROLES_BY_ID[role]) {
    return NextResponse.json({ error: "Please choose a valid role." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .delete()
    .eq("role", role)
    .select("net_id");

  if (error) return serverError();

  if (SHEET_ACCESS_ROLES.has(role)) {
    after(() => Promise.all(
      data.map((u) => syncSheetAccessForRole(u.net_id, null).catch((e) => console.error(`sheet access revoke failed for ${u.net_id}:`, e.message)))
    ));
  }

  return NextResponse.json({ deleted: data.length });
}
