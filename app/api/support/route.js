import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { parseSupportForm, limitSupportSubmission, notifySupportTicket, SupportError } from "../../../lib/supportServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Please submit from this website's support form." }, { status: 403 });
  try {
    const ticket = await parseSupportForm(request);
    await limitSupportSubmission(ticket, request);
    const { error } = await supabaseServer.from(table("supportTickets")).insert(ticket);
    // A lost response can be retried with the same UUID without sending a
    // second email. Do not return any previously stored private information.
    if (error?.code === "23505") return NextResponse.json({ id: ticket.id, saved: true }, { status: 200 });
    if (error) throw new SupportError("Your ticket could not be saved. Please try again.", 503);
    const notification = await notifySupportTicket(ticket.id).catch(() => "pending");
    return NextResponse.json({ id: ticket.id, saved: true, notification }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportError ? error.message : "Your ticket could not be submitted. Please try again." }, { status: error instanceof SupportError ? error.status : 500 });
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "lead_web_dev") return NextResponse.json({ error: "Only the lead web developer can view support tickets." }, { status: 403 });
  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0);
  const { data, error } = await supabaseServer.from(table("supportTickets"))
    .select("id, net_id, full_name, subject, category, description, status, created_at, notification_status, notified_at")
    .order("created_at", { ascending: false }).range(offset, offset + 49);
  if (error) return NextResponse.json({ error: "Tickets could not be loaded." }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
