import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const allowed = ["number", "goal", "start_date", "end_date"];
  const updates = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = key === "number" ? Number(body[key]) : (body[key] ?? null);
    }
  }
  if (updates.goal != null) updates.goal = String(updates.goal).trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRow } = await supabaseServer.from(table("sprints")).select("*").eq("id", id).maybeSingle();
    const current = await getEffectiveRow(netID, "sprints", id, realRow);
    if (!current) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    const merged = { ...current, ...updates };
    await sandboxWrite(netID, "sprints", "update", id, merged);
    return NextResponse.json(merged);
  }

  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { id } = await params;

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    await sandboxWrite(netID, "sprints", "delete", id, null);
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabaseServer.from(table("sprints")).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
