import { NextResponse, after } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { syncSheetAccessForRole } from "../../../../lib/sheetAccess";
import { parseGroupNumber } from "../../../../lib/fieldRules";
import { ROLES_BY_ID } from "../../../../lib/roles";
import { forbidden, serverError } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

// Course leads manage everyone. Head PMs manage PMs and students, but can't
// change anyone's role. Nobody else edits or removes people.
const FULL_USER_ACCESS = ["course_lead"];
const HEAD_PM_ROLES = ["PM", "STUDENT"];
const canManagePeople = (role) => FULL_USER_ACCESS.includes(role) || role === "head_pm";

/** For a head PM, the target must be a PM or student; course leads may act on anyone. */
async function checkTarget(userRole, netId) {
  if (FULL_USER_ACCESS.includes(userRole)) return null;
  const { data: target, error } = await supabaseServer.from(table("users")).select("role").eq("net_id", netId).maybeSingle();
  if (error) return serverError();
  if (!target || !HEAD_PM_ROLES.includes(target.role)) {
    return NextResponse.json({ error: "You do not have permission to change this person." }, { status: 403 });
  }
  return null;
}

export async function PATCH(request, { params }) {
  const { role: userRole } = await getSessionUser();
  if (!canManagePeople(userRole)) return forbidden();

  const { net_id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please provide the changes to save." }, { status: 400 });
  const updates = {};

  if (body.name !== undefined) {
    if (body.name != null && typeof body.name !== "string") return NextResponse.json({ error: "Please enter the name as text." }, { status: 400 });
    updates.name = body.name?.trim() || null;
  }
  if (body.group_number !== undefined) {
    const group = parseGroupNumber(body.group_number);
    if (group.error) return NextResponse.json({ error: group.error }, { status: 400 });
    updates.group_number = group.value;
  }
  if (body.role !== undefined) {
    if (!FULL_USER_ACCESS.includes(userRole)) {
      return NextResponse.json({ error: "Only a course lead can change someone's role." }, { status: 403 });
    }
    if (typeof body.role !== "string" || !ROLES_BY_ID[body.role]) {
      return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    }
    updates.role = body.role;
  }

  const denied = await checkTarget(userRole, net_id);
  if (denied) return denied;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Please provide at least one field to change." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .update(updates)
    .eq("net_id", net_id)
    .select()
    .maybeSingle();
  if (error) return serverError();
  if (!data) return NextResponse.json({ error: "We could not find that person." }, { status: 404 });

  // Keep the shared attendance sheet's access list in sync with the roster -
  // grants course_lead/head_pm/lead_web_dev, revokes everyone else. Fire and
  // forget: a slow/failed Drive API call should never hold up the People UI.
  if (updates.role !== undefined) {
    after(() => syncSheetAccessForRole(net_id, updates.role).catch((e) => console.error(`sheet access sync failed for ${net_id}:`, e.message)));
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { role: userRole } = await getSessionUser();
  if (!canManagePeople(userRole)) return forbidden();

  const { net_id } = await params;
  const denied = await checkTarget(userRole, net_id);
  if (denied) return denied;

  const { error } = await supabaseServer.from(table("users")).delete().eq("net_id", net_id);
  if (error) return serverError();

  // A deleted user is gone from the roster entirely - revoke sheet access
  // the same as any other role change away from a privileged role.
  after(() => syncSheetAccessForRole(net_id, null).catch((e) => console.error(`sheet access revoke failed for ${net_id}:`, e.message)));

  return NextResponse.json({ success: true });
}
