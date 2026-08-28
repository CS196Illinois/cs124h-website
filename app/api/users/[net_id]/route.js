import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite, resetSandbox } from "../../../../lib/sandbox";

const FULL_USER_ACCESS = ["course_lead", "web_dev"];
const WEB_TEAM_ROLES   = ["LEAD_WEB", "WEB"];
const HEAD_PM_ROLES    = ["PM", "STUDENT"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const callerNetId = session?.user?.netID;

  if (!userRole || userRole === "error" || userRole === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { net_id } = await params;
  const body = await request.json();
  const updates = {};

  if (body.name         !== undefined) updates.name         = body.name;
  if (body.group_number !== undefined) updates.group_number = body.group_number || null;

  if (body.role !== undefined) {
    if (!FULL_USER_ACCESS.includes(userRole) && userRole !== "lead_web_dev") {
      return NextResponse.json({ error: "Insufficient permissions to change roles" }, { status: 403 });
    }
    if (userRole === "lead_web_dev" && !WEB_TEAM_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Lead Web Devs can only assign WEB or LEAD_WEB roles" }, { status: 403 });
    }
    updates.role = body.role;
  }

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(callerNetId)) !== "off";

  // Scope checks: lead_web_dev and head_pm can only edit their own team members
  if (userRole === "lead_web_dev" || userRole === "head_pm") {
    const allowed = userRole === "lead_web_dev" ? WEB_TEAM_ROLES : HEAD_PM_ROLES;
    const { data: realTarget } = await supabaseServer.from(table("users")).select("*").eq("net_id", net_id).maybeSingle();
    const target = sandboxed ? await getEffectiveRow(callerNetId, "users", net_id, realTarget) : realTarget;
    if (!target || !allowed.includes(target.role)) {
      return NextResponse.json({ error: "Insufficient permissions to edit this user" }, { status: 403 });
    }
    // head_pm cannot change roles
    if (userRole === "head_pm" && body.role !== undefined) {
      return NextResponse.json({ error: "Head PMs cannot change user roles" }, { status: 403 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (sandboxed) {
    const { data: realRow } = await supabaseServer.from(table("users")).select("*").eq("net_id", net_id).maybeSingle();
    const current = await getEffectiveRow(callerNetId, "users", net_id, realRow);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const merged = { ...current, ...updates };
    // A sandboxed edit must never trigger a real side effect on the target's
    // own (real) sandbox - resetSandbox below only ever runs on the real
    // write path, never here, even though the update shape looks the same.
    await sandboxWrite(callerNetId, "users", "update", net_id, merged);
    return NextResponse.json(merged);
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .update(updates)
    .eq("net_id", net_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "until their access is revoked" - a role change away from the web team
  // clears any sandbox (ephemeral or persistent) regardless of the user's
  // own preference, since they can no longer reach the routes that read it.
  if (updates.role !== undefined && !WEB_TEAM_ROLES.includes(updates.role)) {
    await resetSandbox(net_id);
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const callerNetId = session?.user?.netID;

  const canDelete = FULL_USER_ACCESS.includes(userRole) || userRole === "lead_web_dev" || userRole === "head_pm";
  if (!canDelete) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { net_id } = await params;
  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(callerNetId)) !== "off";

  if (userRole === "lead_web_dev" || userRole === "head_pm") {
    const allowed = userRole === "lead_web_dev" ? WEB_TEAM_ROLES : HEAD_PM_ROLES;
    const { data: realTarget } = await supabaseServer.from(table("users")).select("*").eq("net_id", net_id).maybeSingle();
    const target = sandboxed ? await getEffectiveRow(callerNetId, "users", net_id, realTarget) : realTarget;
    if (!target || !allowed.includes(target.role)) {
      return NextResponse.json({ error: "Insufficient permissions to remove this user" }, { status: 403 });
    }
  }

  if (sandboxed) {
    // Same reasoning as PATCH above: a sandboxed delete must never trigger
    // the real resetSandbox side effect below, even if net_id happens to
    // belong to a real web_dev/lead_web_dev.
    await sandboxWrite(callerNetId, "users", "delete", net_id, null);
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseServer
    .from(table("users"))
    .delete()
    .eq("net_id", net_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hygiene: a removed user can never reach a sandboxed route again, so
  // this is just avoiding an orphaned overlay, not a security requirement.
  await resetSandbox(net_id);

  return NextResponse.json({ success: true });
}
