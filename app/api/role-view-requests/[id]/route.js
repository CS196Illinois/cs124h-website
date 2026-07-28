import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

const DEFAULT_DURATION_DAYS = 7;

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (userRole !== "lead_web_dev") {
    return NextResponse.json({ error: "Only Lead Web Devs can review role view requests" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { status, duration_days } = body;
  if (!["approved", "denied"].includes(status)) {
    return NextResponse.json({ error: "status must be 'approved' or 'denied'" }, { status: 400 });
  }

  let expires_at = null;
  if (status === "approved") {
    // duration_days === null explicitly means "Permanent" (see the UI) — only
    // a genuinely omitted key falls back to the default. `??` would treat
    // both the same and silently downgrade "Permanent" to 7 days.
    const days = duration_days !== undefined ? duration_days : DEFAULT_DURATION_DAYS;
    if (days !== null) {
      const d = Number(days);
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json({ error: "duration_days must be a positive number or null (permanent)" }, { status: 400 });
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
  // doesn't exist OR isn't pending anymore — both are "not found" here, not
  // a server error.
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

  if (userRole !== "lead_web_dev") {
    return NextResponse.json({ error: "Only Lead Web Devs can revoke role view access" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseServer
    .from(table("roleViewRequests"))
    .delete()
    .eq("id", id)
    .eq("status", "approved");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
