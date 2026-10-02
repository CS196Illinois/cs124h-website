import { getServerSession } from "next-auth";
import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../../lib/supabaseServer";
import { table } from "../../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../../../../lib/sandbox";
import { getManagedEvent } from "../../../../../../lib/events";
import { syncEventAttendance } from "../../../../../../lib/eventAttendanceSync";
import { CHECKIN_NETID_MAX } from "../../../../../../lib/fieldRules";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

// Staff: manually check someone in - e.g. they forgot their phone, or a
// guest isn't doing the self-service code flow. Same insert and same
// post-insert sheet sync as the real check-in path (checkin/route.js); the
// only differences are that staff pick the net_id and no code is required.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await getManagedEvent(id, netID, userRole))) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }
  const { net_id } = await request.json().catch(() => ({}));
  const cleanNetId = typeof net_id === "string" ? net_id.trim().toLowerCase() : "";
  if (!cleanNetId) {
    return NextResponse.json({ error: "Please choose a person." }, { status: 400 });
  }
  // event_checkins.net_id is varchar(50) in the database.
  if (cleanNetId.length > CHECKIN_NETID_MAX) {
    return NextResponse.json({ error: "That NetID is too long." }, { status: 400 });
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRows } = await supabaseServer
      .from(table("eventCheckins")).select("*").eq("event_id", id).eq("net_id", cleanNetId);
    const merged = await mergeSandboxRows(
      netID, "eventCheckins", realRows ?? [],
      (row) => row.event_id === id && row.net_id === cleanNetId,
    );
    if (merged[0]) {
      return NextResponse.json({ error: `${cleanNetId} is already checked in.` }, { status: 409 });
    }
    const checkinId = randomUUID();
    await sandboxWrite(netID, "eventCheckins", "insert", checkinId, {
      id: checkinId, event_id: id, net_id: cleanNetId, checked_in_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const { error } = await supabaseServer
    .from(table("eventCheckins"))
    .insert({ event_id: id, net_id: cleanNetId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `${cleanNetId} is already checked in.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  }

  after(() => syncEventAttendance(id).catch((e) => console.error(`manual add sheet sync failed for event ${id}:`, e.message)));

  return NextResponse.json({ success: true }, { status: 201 });
}

// Staff: remove a check-in - added by mistake, or someone checked in on a
// friend's behalf. Full clear-and-rewrite sync means the removal actually
// disappears from the sheet too, not just stops the count from growing.
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await getManagedEvent(id, netID, userRole))) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const netId = searchParams.get("net_id");
  if (!netId) {
    return NextResponse.json({ error: "Please choose a person." }, { status: 400 });
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRows } = await supabaseServer
      .from(table("eventCheckins")).select("*").eq("event_id", id).eq("net_id", netId);
    const merged = await mergeSandboxRows(
      netID, "eventCheckins", realRows ?? [],
      (row) => row.event_id === id && row.net_id === netId,
    );
    if (merged[0]) {
      await sandboxWrite(netID, "eventCheckins", "delete", String(merged[0].id), null);
    }
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseServer
    .from(table("eventCheckins"))
    .delete()
    .eq("event_id", id)
    .eq("net_id", netId);

  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  after(() => syncEventAttendance(id).catch((e) => console.error(`manual remove sheet sync failed for event ${id}:`, e.message)));

  return NextResponse.json({ success: true });
}
