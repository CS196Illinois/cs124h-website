import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

const FULL_USER_ACCESS = ["course_lead", "web_dev"];
const WEB_TEAM_ROLES   = ["LEAD_WEB", "WEB"];
const HEAD_PM_ROLES    = ["PM", "STUDENT"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

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

  // Scope checks: lead_web_dev and head_pm can only edit their own team members
  if (userRole === "lead_web_dev" || userRole === "head_pm") {
    const allowed = userRole === "lead_web_dev" ? WEB_TEAM_ROLES : HEAD_PM_ROLES;
    const { data: target } = await supabaseServer.from(table("users")).select("role").eq("net_id", net_id).maybeSingle();
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

  const { data, error } = await supabaseServer
    .from(table("users"))
    .update(updates)
    .eq("net_id", net_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

  const canDelete = FULL_USER_ACCESS.includes(userRole) || userRole === "lead_web_dev" || userRole === "head_pm";
  if (!canDelete) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { net_id } = await params;

  if (userRole === "lead_web_dev" || userRole === "head_pm") {
    const allowed = userRole === "lead_web_dev" ? WEB_TEAM_ROLES : HEAD_PM_ROLES;
    const { data: target } = await supabaseServer.from(table("users")).select("role").eq("net_id", net_id).maybeSingle();
    if (!target || !allowed.includes(target.role)) {
      return NextResponse.json({ error: "Insufficient permissions to remove this user" }, { status: 403 });
    }
  }

  const { error } = await supabaseServer
    .from(table("users"))
    .delete()
    .eq("net_id", net_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
