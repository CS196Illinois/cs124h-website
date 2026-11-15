import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { validateMp, MP_MANAGE_ROLES } from "../../../../lib/mps";
import { forbidden, serverError } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

export async function PATCH(request, { params }) {
  const { role } = await getSessionUser();
  if (!MP_MANAGE_ROLES.includes(role)) return forbidden();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { data: current, error: loadError } = await supabaseServer.from(table("mps")).select("release_at, due_at").eq("id", id).maybeSingle();
  if (loadError) return serverError();
  if (!current) return NextResponse.json({ error: "That MP no longer exists." }, { status: 404 });
  // Validate against the stored dates for whichever one isn't being changed.
  const { values, error: invalid } = validateMp({ release_at: current.release_at, due_at: current.due_at, ...body }, { partial: true });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("mps")).update(values).eq("id", id).select().maybeSingle();
  if (error) return serverError();
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { role } = await getSessionUser();
  if (!MP_MANAGE_ROLES.includes(role)) return forbidden();
  const { id } = await params;
  const { data, error } = await supabaseServer.from(table("mps")).delete().eq("id", id).select("id");
  if (error) return serverError();
  if (!data?.length) return NextResponse.json({ error: "That MP no longer exists." }, { status: 404 });
  return NextResponse.json({ success: true });
}
