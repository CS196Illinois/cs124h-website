import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { notifySupportTicket } from "../../../../lib/supportServer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "lead_web_dev") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseServer.from(table("supportTickets")).select("id, attachments").eq("id", (await params).id).maybeSingle();
  if (error) return NextResponse.json({ error: "Screenshots could not be loaded." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "lead_web_dev") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.retry_notification === true) {
    try { return NextResponse.json({ notification: await notifySupportTicket(id) }); }
    catch { return NextResponse.json({ error: "Notification could not be retried." }, { status: 503 }); }
  }
  if (!["open", "resolved"].includes(body?.status)) return NextResponse.json({ error: "Choose open or resolved." }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("supportTickets")).update({ status: body.status }).eq("id", id).select("id, status").maybeSingle();
  if (error) return NextResponse.json({ error: "Ticket could not be updated." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  return NextResponse.json(data);
}
