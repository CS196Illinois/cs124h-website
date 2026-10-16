import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";
import { eventHasEnded, validateEventAudience, validateEventHosts, getManagedEvent, getCheckInEvent, canRunCheckIn } from "../../../../lib/events";
import { EVENT_TEXT_MAX } from "../../../../lib/fieldRules";
import { serverError, signInRequired } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

export async function PATCH(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();

  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid event update." }, { status: 400 });
  // Opening/closing check-in is also open to hosts and course leads; every
  // other change stays creator-only.
  const checkInOnly = Object.keys(body).length > 0 && Object.keys(body).every((key) => key === "check_in_open");
  const managed = checkInOnly ? await getCheckInEvent(id, netID, userRole, "*") : await getManagedEvent(id, netID, userRole, "*");
  if (!managed) {
    return NextResponse.json({ error: checkInOnly ? "Only the event's creator, hosts, or a course lead can run its check-in." : "Only the creator can change this event." }, { status: 403 });
  }
  const updates = {};
  if (body.hosts !== undefined) {
    const hosts = await validateEventHosts(body.hosts, netID, userRole);
    if (hosts.error) return NextResponse.json({ error: hosts.error }, { status: hosts.status || 400 });
    updates.hosts = hosts.values;
  }
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
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Please enter a title." }, { status: 400 });
    updates.title = body.title.trim();
  }
  if ([body.description, body.location].some((value) => value != null && typeof value !== "string")) {
    return NextResponse.json({ error: "Description and location must be text" }, { status: 400 });
  }
  if ([updates.title, body.location].some((value) => typeof value === "string" && value.trim().length > EVENT_TEXT_MAX)) {
    return NextResponse.json({ error: `Title and location must be ${EVENT_TEXT_MAX} characters or fewer.` }, { status: 400 });
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.location   !== undefined) updates.location   = body.location?.trim() || null;

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("events")).select("*").eq("id", id).maybeSingle();
    const current = await getEffectiveRow(netID, "events", id, realRow);
    if (!current || !(checkInOnly ? canRunCheckIn(current, netID, userRole) : current.created_by === netID)) {
      return NextResponse.json({ error: "That event could not be found, or you do not have permission to edit it." }, { status: 403 });
    }
    const merged = { ...current, ...updates };
    await sandboxWrite(netID, "events", "update", id, merged);
    return NextResponse.json(merged);
  }

  // Only the event's creator can edit it; check-in access was checked above.
  let query = supabaseServer.from(table("events")).update(updates).eq("id", id);
  if (!checkInOnly) query = query.eq("created_by", netID);
  const { data, error } = await query.select().maybeSingle();
  if (error) return serverError();
  if (!data) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to edit it." }, { status: 403 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();

  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
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
  if (error) return serverError();
  // A scoped delete matching 0 rows means either the event doesn't exist, or
  // (more likely) it belongs to someone else and this caller isn't full-access -
  // surface that instead of silently no-opping.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to delete it." }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}
