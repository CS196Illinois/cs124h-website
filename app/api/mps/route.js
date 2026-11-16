import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { validateMp, MP_MANAGE_ROLES } from "../../../lib/mps";
import { forbidden, serverError } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";
import { currentTerm } from "../../../lib/term";

/** This semester's MPs, including ones not open yet, for the people who manage them. */
export async function GET() {
  const { role } = await getSessionUser();
  if (!MP_MANAGE_ROLES.includes(role)) return forbidden();
  const { data, error } = await supabaseServer.from(table("mps")).select("*")
    .gte("due_at", `${currentTerm().from}T00:00:00Z`).order("due_at", { ascending: true });
  if (error) return serverError();
  return NextResponse.json(data);
}

export async function POST(request) {
  const { role } = await getSessionUser();
  if (!MP_MANAGE_ROLES.includes(role)) return forbidden();
  const { values, error: invalid } = validateMp(await request.json().catch(() => null));
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("mps")).insert(values).select().single();
  if (error) return serverError();
  return NextResponse.json(data, { status: 201 });
}
