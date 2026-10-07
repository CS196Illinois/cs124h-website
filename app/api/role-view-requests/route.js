import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { invalidInput, serverError, signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";

const REQUESTABLE_ROLES = ["course_lead", "head_pm", "pm", "student"];

async function purgeExpired() {
  await supabaseServer
    .from(table("roleViewRequests"))
    .delete()
    .eq("status", "approved")
    .lt("expires_at", new Date().toISOString())
    .not("expires_at", "is", null);
}

export async function GET() {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  if (userRole !== "lead_web_dev" && userRole !== "web_dev") {
    return signInRequired(403);
  }

  // Lazily clean up expired approved rows on every read
  await purgeExpired();

  let query = supabaseServer
    .from(table("roleViewRequests"))
    .select("*")
    .order("created_at", { ascending: false });

  if (userRole === "web_dev") {
    query = query.eq("requester_net_id", netID);
  }

  const { data, error } = await query;
  if (error) return serverError();
  return NextResponse.json(data);
}

export async function POST(request) {
  const { role: userRole, netID } = await getSessionUser();

  if (userRole !== "web_dev") {
    return NextResponse.json({ error: "Only Web Devs can request access to another role’s pages." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return invalidInput();

  const { requested_role } = body;
  if (!REQUESTABLE_ROLES.includes(requested_role)) {
    return NextResponse.json({ error: "Please choose a role you are allowed to view." }, { status: 400 });
  }

  // Check for existing pending or non-expired approved request
  const { data: existing } = await supabaseServer
    .from(table("roleViewRequests"))
    .select("id, status, expires_at")
    .eq("requester_net_id", netID)
    .eq("requested_role", requested_role)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    const isExpired =
      existing.status === "approved" &&
      existing.expires_at &&
      new Date(existing.expires_at) <= new Date();

    if (!isExpired) {
      return NextResponse.json(
        { error: existing.status === "approved" ? "Already approved" : "Request already pending" },
        { status: 409 }
      );
    }
    // Expired approval exists - delete it so they can re-request
    await supabaseServer.from(table("roleViewRequests")).delete().eq("id", existing.id);
  }

  const { data, error } = await supabaseServer
    .from(table("roleViewRequests"))
    .insert({ requester_net_id: netID, requested_role, status: "pending" })
    .select()
    .single();

  if (error) return serverError();
  return NextResponse.json(data, { status: 201 });
}
