import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];
const FULL_EVENT_ACCESS = ["course_lead", "lead_web_dev", "web_dev"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates = {};

  if (body.check_in_open !== undefined) {
    updates.check_in_open = body.check_in_open;
    if (body.check_in_open) {
      updates.check_in_opened_at = new Date().toISOString();
    }
  }
  if (body.title      !== undefined) updates.title      = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.location   !== undefined) updates.location   = body.location;

  // Only the creator can modify, except course_lead can modify any
  let query = supabaseServer.from(table("events")).update(updates).eq("id", id);
  if (!FULL_EVENT_ACCESS.includes(userRole)) query = query.eq("created_by", netID);

  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  let query = supabaseServer.from(table("events")).delete().eq("id", id);
  if (!FULL_EVENT_ACCESS.includes(userRole)) query = query.eq("created_by", netID);

  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // A scoped delete matching 0 rows means either the event doesn't exist, or
  // (more likely) it belongs to someone else and this caller isn't full-access -
  // surface that instead of silently no-opping.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found, or you don't have permission to delete this event" }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}
