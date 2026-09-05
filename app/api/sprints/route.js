import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../lib/sandbox";
import { normalizeQuestions } from "../../../lib/sprintChecks";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .select("*")
    .order("number", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprints", rows, () => true);
    rows.sort((a, b) => b.number - a.number);
  }

  // Understanding-check question text is only for the roles that author it -
  // a PM/student only ever learns it through /api/sprints/[id]/check, which
  // gates it on the check actually being open for their group.
  if (!MANAGE_ROLES.includes(userRole)) {
    rows = rows.map(({ check_questions, check_max_score, ...rest }) => rest);
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { number, goal, start_date, end_date, check_questions, check_max_score } = body;
  if (number == null || !goal?.trim()) {
    return NextResponse.json({ error: "number and goal are required" }, { status: 400 });
  }
  const row = {
    number: Number(number),
    goal: goal.trim(),
    start_date: start_date || null,
    end_date: end_date || null,
    check_questions: normalizeQuestions(check_questions),
    check_max_score: check_max_score || null,
  };

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const fullRow = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    await sandboxWrite(netID, "sprints", "insert", fullRow.id, fullRow);
    return NextResponse.json(fullRow, { status: 201 });
  }

  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
