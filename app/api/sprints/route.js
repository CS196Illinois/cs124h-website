import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .select("*")
    .order("number", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { number, goal, start_date, end_date } = body;
  if (number == null || !goal?.trim()) {
    return NextResponse.json({ error: "number and goal are required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .insert({ number: Number(number), goal: goal.trim(), start_date: start_date || null, end_date: end_date || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
