import { getUserGroup, groupSprintChecks } from "../../../lib/groupSprintChecks";
import { actsAsPm } from "../../../lib/roles";
import { parseSprintNumber } from "../../../lib/fieldRules";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../lib/sandbox";
import { normalizeQuestions } from "../../../lib/sprintChecks";
import { isSprintVisibleToRole, validateSprintDates } from "../../../lib/sprintVisibility";
import { forbidden, invalidInput, serverError, signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";
import { sprintNumberTaken, sprintNumberTakenMessage } from "../../../lib/sprintNumbers";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

export async function GET(request) {
  const { role: userRole, netID } = await getSessionUser();
  if (!userRole || userRole === "error") {
    return signInRequired();
  }
  const { data, error } = await supabaseServer
    .from(table("sprints"))
    .select("*")
    .order("number", { ascending: false });
  if (error) return serverError();

  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprints", rows, () => true);
    rows.sort((a, b) => b.number - a.number);
  }
  rows = rows.filter((sprint) => isSprintVisibleToRole(sprint, userRole));

  if (actsAsPm(userRole, new URL(request.url).searchParams.get("view"))) {
    rows = await groupSprintChecks(rows, await getUserGroup(netID), netID, userRole);
  }

  // PMs need the saved question list to append questions without overwriting
  // required ones. Students see questions only through the gated check API.
  if (userRole === "student") {
    rows = rows.map(({ check_questions, check_max_score, ...rest }) => rest);
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const { role: userRole, netID } = await getSessionUser();
  if (!MANAGE_ROLES.includes(userRole)) {
    return forbidden();
  }
  const body = await request.json().catch(() => null);
  if (!body) return invalidInput();
  const { number, goal, start_date, end_date, check_questions, check_max_score } = body;
  if (number == null || typeof goal !== "string" || !goal.trim()) {
    return NextResponse.json({ error: "Please enter both a sprint number and a goal." }, { status: 400 });
  }
  const parsedNumber = parseSprintNumber(number);
  if (parsedNumber.error) return NextResponse.json({ error: parsedNumber.error }, { status: 400 });
  const sprintNumber = parsedNumber.value;
  try {
    if (await sprintNumberTaken(sprintNumber, { netID, role: userRole })) {
      return NextResponse.json({ error: sprintNumberTakenMessage(sprintNumber) }, { status: 409 });
    }
  } catch { return serverError(); }
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
  if (error) return serverError();
  return NextResponse.json(data, { status: 201 });
}
