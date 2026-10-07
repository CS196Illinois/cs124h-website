import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { invalidInput, serverError } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

const DEFAULT_DURATION_DAYS = 7;

export async function PATCH(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();

  if (userRole !== "lead_web_dev") {
    return NextResponse.json({ error: "Only Lead Web Devs can review access requests." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return invalidInput();

  const { status, duration_days } = body;
  if (!["approved", "denied"].includes(status)) {
    return NextResponse.json({ error: "Please choose either Approve or Deny." }, { status: 400 });
  }

  let expires_at = null;
  if (status === "approved") {
    // duration_days === null explicitly means "Permanent" (see the UI) - only
    // a genuinely omitted key falls back to the default. `??` would treat
    // both the same and silently downgrade "Permanent" to 7 days.
    const days = duration_days !== undefined ? duration_days : DEFAULT_DURATION_DAYS;
    if (days !== null) {
      const d = Number(days);
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json({ error: "Access duration must be a positive number, or left blank for permanent access." }, { status: 400 });
      }
      expires_at = new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const patch = {
    status,
    reviewed_by: netID,
    reviewed_at: new Date().toISOString(),
    ...(status === "approved" ? { expires_at } : {}),
  };

  const { data, error } = await supabaseServer
    .from(table("roleViewRequests"))
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  // PGRST116 = .single() matched zero rows, which happens whenever the id
  // doesn't exist OR isn't pending anymore - both are "not found" here, not
  // a server error.
  if (error && error.code !== "PGRST116") {
    return serverError();
  }
  if (!data) return NextResponse.json({ error: "That request could not be found or has already been reviewed." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { role: userRole } = await getSessionUser();

  if (userRole !== "lead_web_dev") {
    return NextResponse.json({ error: "Only Lead Web Devs can remove role-view access." }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseServer
    .from(table("roleViewRequests"))
    .delete()
    .eq("id", id)
    .eq("status", "approved");

  if (error) return serverError();
  return NextResponse.json({ success: true });
}
