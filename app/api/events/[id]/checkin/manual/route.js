import { getServerSession } from "next-auth";
import { NextResponse, after } from "next/server";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../../lib/supabaseServer";
import { table } from "../../../../../../lib/tables";
import { syncEventAttendance } from "../../../../../../lib/eventAttendanceSync";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

// Staff: manually check someone in - e.g. they forgot their phone, or a
// guest isn't doing the self-service code flow. Same insert and same
// post-insert sheet sync as the real check-in path (checkin/route.js); the
// only differences are that staff pick the net_id and no code is required.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { net_id } = await request.json();
  const cleanNetId = net_id?.trim().toLowerCase();
  if (!cleanNetId) {
    return NextResponse.json({ error: "net_id is required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from(table("eventCheckins"))
    .insert({ event_id: id, net_id: cleanNetId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `${cleanNetId} is already checked in.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const netId = searchParams.get("net_id");
  if (!netId) {
    return NextResponse.json({ error: "net_id is required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from(table("eventCheckins"))
    .delete()
    .eq("event_id", id)
    .eq("net_id", netId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(() => syncEventAttendance(id).catch((e) => console.error(`manual remove sheet sync failed for event ${id}:`, e.message)));

  return NextResponse.json({ success: true });
}
