import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../lib/sandbox";
import { normalizeQuestions } from "../../../lib/sprintChecks";
import { isSprintVisibleToRole, validateSprintDates } from "../../../lib/sprintVisibility";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .select("*")
    .order("number", { ascending: false });
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprints", rows, () => true);
    rows.sort((a, b) => b.number - a.number);
  }
  rows = rows.filter((sprint) => isSprintVisibleToRole(sprint, userRole));

  // PMs need the saved question list to append questions without overwriting
  // required ones. Students see questions only through the gated check API.
  if (userRole === "student") {
    rows = rows.map(({ check_questions, check_max_score, ...rest }) => rest);
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Please check the information you entered and try again." }, { status: 400 });
  const { number, goal, start_date, end_date, check_questions, check_max_score } = body;
  if (number == null || !goal?.trim()) {
    return NextResponse.json({ error: "Please enter both a sprint number and a goal." }, { status: 400 });
  }
  const sprintNumber = Number(number);
  if (!Number.isInteger(sprintNumber) || sprintNumber < 0) {
    return NextResponse.json({ error: "Sprint number must be a non-negative whole number." }, { status: 400 });
  }
  const dateError = validateSprintDates(start_date, end_date);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
  if (check_max_score != null && check_max_score !== "" && (!Number.isFinite(Number(check_max_score)) || Number(check_max_score) <= 0)) {
    return NextResponse.json({ error: "Maximum score must be a positive number." }, { status: 400 });
  }
  const row = {
    number: sprintNumber,
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
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
