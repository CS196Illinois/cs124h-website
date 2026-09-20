import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";
import { eventHasEnded, validateEventAudience, getManagedEvent } from "../../../../lib/events";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid event update." }, { status: 400 });
  const managed = await getManagedEvent(id, netID, userRole, "*");
  if (!managed) return NextResponse.json({ error: "Only the creator can change this event." }, { status: 403 });
  const updates = {};
  if ("audience_type" in body || "audience_values" in body) {
    const type = body.audience_type ?? managed.audience_type ?? "all";
    const audience = await validateEventAudience(type, body.audience_values ?? managed.audience_values ?? [], netID, userRole);
    if (audience.error) return NextResponse.json({ error: audience.error }, { status: audience.status || 400 });
    updates.audience_type = type;
    updates.audience_values = audience.values;
  }

  if (body.check_in_open !== undefined) {
    if (typeof body.check_in_open !== "boolean") return NextResponse.json({ error: "Invalid check-in state." }, { status: 400 });
    if (body.check_in_open) {
      if (eventHasEnded(managed)) return NextResponse.json({ error: "This event has already ended, so check-in cannot be opened." }, { status: 400 });
    }
    updates.check_in_open = body.check_in_open;
    if (body.check_in_open) {
      updates.check_in_opened_at = new Date().toISOString();
    }
  }
  if (body.title      !== undefined) updates.title      = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.location   !== undefined) updates.location   = body.location;

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("events")).select("*").eq("id", id).maybeSingle();
    const current = await getEffectiveRow(netID, "events", id, realRow);
    if (!current || current.created_by !== netID) {
      return NextResponse.json({ error: "That event could not be found, or you do not have permission to edit it." }, { status: 403 });
    }
    const merged = { ...current, ...updates };
    await sandboxWrite(netID, "events", "update", id, merged);
    return NextResponse.json(merged);
  }

  // Only the event's creator can manage it.
  let query = supabaseServer.from(table("events")).update(updates).eq("id", id);
  query = query.eq("created_by", netID);
  const { data, error } = await query.select().maybeSingle();
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to edit it." }, { status: 403 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
  }

  const { id } = await params;

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("events")).select("*").eq("id", id).maybeSingle();
    const current = await getEffectiveRow(netID, "events", id, realRow);
    if (!current || current.created_by !== netID) {
      return NextResponse.json({ error: "That event could not be found, or you do not have permission to delete it." }, { status: 403 });
    }
    await sandboxWrite(netID, "events", "delete", id, null);
    return NextResponse.json({ success: true });
  }

  let query = supabaseServer.from(table("events")).delete().eq("id", id);
  query = query.eq("created_by", netID);
  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  // A scoped delete matching 0 rows means either the event doesn't exist, or
  // (more likely) it belongs to someone else and this caller isn't full-access -
  // surface that instead of silently no-opping.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to delete it." }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}
