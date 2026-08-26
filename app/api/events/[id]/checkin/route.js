import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { deriveCode } from "../code/route";
import { isSandboxRole, getSandboxMode, getEffectiveRow, mergeSandboxRows, sandboxWrite } from "../../../../../lib/sandbox";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

// Staff: view attendees for an event
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await supabaseServer
    .from(table("eventCheckins"))
    .select("net_id, checked_in_at")
    .eq("event_id", id)
    .order("checked_in_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "eventCheckins", rows, (row) => row.event_id === id);
    rows.sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
  }
  return NextResponse.json(rows);
}

// Any authenticated user: submit a check-in code
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { code } = await request.json();

  if (!code?.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const sandboxed = isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off";

  // Verify event exists and check-in is currently open
  const { data: realEvent } = await supabaseServer
    .from(table("events"))
    .select("id, title, check_in_open")
    .eq("id", id)
    .maybeSingle();
  const event = sandboxed ? await getEffectiveRow(netID, "events", id, realEvent) : realEvent;

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.check_in_open) {
    return NextResponse.json({ error: "Check-in is not open for this event." }, { status: 400 });
  }

  // Validate against current window and previous window (grace period for slow typers)
  const submitted = code.trim().replace(/\s/g, "");
  const valid =
    submitted === deriveCode(id, 0) ||
    submitted === deriveCode(id, -1);

  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect code. Make sure you're reading the latest code from the screen." },
      { status: 400 }
    );
  }

  if (sandboxed) {
    try {
      const checkinId = randomUUID();
      await sandboxWrite(
        netID, "eventCheckins", "insert", checkinId,
        { id: checkinId, event_id: id, net_id: netID, checked_in_at: new Date().toISOString() },
        { columns: ["event_id", "net_id"] }
      );
    } catch (e) {
      if (e.code === "23505") {
        return NextResponse.json({ error: "You've already checked in to this event." }, { status: 409 });
      }
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, event_title: event.title }, { status: 201 });
  }

  // Insert - the unique constraint on (event_id, net_id) prevents double check-in
  const { error: insertError } = await supabaseServer
    .from(table("eventCheckins"))
    .insert({ event_id: id, net_id: netID });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You've already checked in to this event." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, event_title: event.title }, { status: 201 });
}
