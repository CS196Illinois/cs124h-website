import { getUserGroup, applyGroupQuestions, saveGroupSprintCheck } from "../../../../lib/groupSprintChecks";
import { actsAsPm } from "../../../../lib/roles";
import { parseSprintNumber } from "../../../../lib/fieldRules";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, sandboxWrite } from "../../../../lib/sandbox";
import { normalizeQuestions, resolveMaxScore } from "../../../../lib/sprintChecks";
import { isSprintVisibleToRole, validateSprintDates } from "../../../../lib/sprintVisibility";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev", "pm"];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }
  const { id } = await params;
  const { data: existingSprint } = await supabaseServer.from(table("sprints")).select("*").eq("id", id).maybeSingle();
  if (!existingSprint) return NextResponse.json({ error: "We could not find that sprint. It may have been removed or is not available yet." }, { status: 404 });
  if (!isSprintVisibleToRole(existingSprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Please check the information you entered and try again." }, { status: 400 });
  // PMs (and a lead web dev previewing the PM page) edit their group's additions.
  const pmView = actsAsPm(userRole, new URL(request.url).searchParams.get("view"));

  // PMs customize their group’s additions; course-wide questions and scoring are protected.
  const allowed = userRole === "pm"
    ? ["check_questions", "check_max_score"]
    : ["number", "goal", "start_date", "end_date", "check_questions", "check_max_score"];
  if (userRole === "pm" && ["number", "goal", "start_date", "end_date"].some((key) => key in body)) {
    return NextResponse.json({ error: "PMs can add questions, but cannot change the sprint number, goal, or dates." }, { status: 403 });
  }
  const updates = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key] ?? null;
    }
  }
  if (updates.goal != null) updates.goal = String(updates.goal).trim();
  if ("goal" in updates && !updates.goal) return NextResponse.json({ error: "Goal cannot be empty." }, { status: 400 });
  const dateError = validateSprintDates(updates.start_date ?? existingSprint.start_date, updates.end_date ?? existingSprint.end_date);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
  if ("number" in updates) {
    const sprintNumber = parseSprintNumber(updates.number);
    if (sprintNumber.error) return NextResponse.json({ error: sprintNumber.error }, { status: 400 });
    updates.number = sprintNumber.value;
  }
  if ("check_questions" in updates) updates.check_questions = normalizeQuestions(updates.check_questions);
  if (pmView && "check_questions" in updates) {
    const changedSavedQuestion = (existingSprint.check_questions ?? []).some((question, index) => updates.check_questions?.[index] !== question);
    if (changedSavedQuestion) return NextResponse.json({ error: "Saved sprint questions cannot be edited, reordered, or disabled by PMs. Ask a course lead to change them." }, { status: 403 });
  }
  if (pmView && "check_max_score" in updates) {
    if (resolveMaxScore({ check_max_score: updates.check_max_score }) !== resolveMaxScore(existingSprint)) {
      return NextResponse.json({ error: "Only sprint managers can change the maximum score." }, { status: 403 });
    }
    delete updates.check_max_score;
  }
  if (updates.check_max_score != null && updates.check_max_score !== "") {
    const maxScore = Number(updates.check_max_score);
    if (!Number.isFinite(maxScore) || maxScore <= 0) return NextResponse.json({ error: "Maximum score must be a positive number." }, { status: 400 });
    updates.check_max_score = maxScore;
  } else if ("check_max_score" in updates) {
    updates.check_max_score = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Please provide at least one field to change." }, { status: 400 });
  }

  let groupQuestions;
  if (pmView && "check_questions" in updates) {
    const groupNumber = await getUserGroup(netID);
    if (groupNumber == null) return NextResponse.json({ error: "You are not assigned to a group yet." }, { status: 400 });
    const required = existingSprint.check_questions ?? [];
    groupQuestions = (updates.check_questions ?? []).slice(required.length);
    await saveGroupSprintCheck(id, groupNumber, groupQuestions, netID, userRole);
    delete updates.check_questions;
    if (!Object.keys(updates).length) {
      return NextResponse.json(applyGroupQuestions(existingSprint, groupQuestions));
    }
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const current = await getEffectiveRow(netID, "sprints", id, existingSprint);
    if (!current) return NextResponse.json({ error: "We could not find that sprint. It may have been removed or is not available yet." }, { status: 404 });
    const merged = { ...current, ...updates };
    await sandboxWrite(netID, "sprints", "update", id, merged);
    return NextResponse.json(groupQuestions ? applyGroupQuestions(merged, groupQuestions) : merged);
  }

  const query = supabaseServer.from(table("sprints")).update(updates).eq("id", id);
  const { data, error } = await query.select().maybeSingle();
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This sprint changed while you were editing. Reload it and try again." }, { status: 409 });
  return NextResponse.json(groupQuestions ? applyGroupQuestions(data, groupQuestions) : data);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (userRole === "pm") return NextResponse.json({ error: "PMs cannot delete sprints." }, { status: 403 });
  if (!MANAGE_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }
  const { id } = await params;
  const { data: existingSprint } = await supabaseServer.from(table("sprints")).select("start_date").eq("id", id).maybeSingle();
  if (!existingSprint) return NextResponse.json({ error: "We could not find that sprint. It may have been removed or is not available yet." }, { status: 404 });
  if (!isSprintVisibleToRole(existingSprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    await sandboxWrite(netID, "sprints", "delete", id, null);
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabaseServer.from(table("sprints")).delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
