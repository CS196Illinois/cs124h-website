import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { MANAGEABLE_BY as MANAGEABLE_ROLES } from "../../../lib/roles";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

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
  return NextResponse.json(data);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

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

  const { data, error } = await supabaseServer
    .from(table("users"))
    .insert({ net_id: net_id.trim().toLowerCase(), role, name: name?.trim() || null, group_number: group_number || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

const BULK_DELETE_ROLES = ["course_lead", "lead_web_dev", "web_dev"];

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!BULK_DELETE_ROLES.includes(session?.user?.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  const VALID_ROLES = ["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"];
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "A valid role query param is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .delete()
    .eq("role", role)
    .select("net_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: data.length });
}
