import { getUserGroup } from "../../../lib/groupSprintChecks";
import { actsAsPm } from "../../../lib/roles";
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { getSessionUser } from "../../../lib/session";

const EDIT_ROLES = ["course_lead", "head_pm", "pm", "web_dev", "lead_web_dev"];

export async function GET(request) {
  const caller = await getSessionUser();
  if (!EDIT_ROLES.includes(caller.role)) return NextResponse.json({ error: "Sign in to view the question bank." }, { status: 401 });
  const pmView = actsAsPm(caller.role, new URL(request.url).searchParams.get("view"));
  const group = pmView ? await getUserGroup(caller.netID) : null;
  let query = supabaseServer.from(table("sprintQuestionBank")).select("*").order("created_at", { ascending: true });
  query = group == null ? query.is("group_number", null) : query.or(`group_number.is.null,group_number.eq.${group}`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Question bank could not be loaded. Please try again." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request) {
  const caller = await getSessionUser();
  if (!EDIT_ROLES.includes(caller.role)) return NextResponse.json({ error: "Only course leads, head PMs, and PMs can add questions." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Enter a question before adding it to the bank." }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "Questions must be 500 characters or fewer." }, { status: 400 });
  const pmView = actsAsPm(caller.role, new URL(request.url).searchParams.get("view"));
  const group = pmView ? await getUserGroup(caller.netID) : null;
  if (pmView && group == null) return NextResponse.json({ error: "You are not assigned to a group yet." }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("sprintQuestionBank")).insert({ question, created_by: caller.netID, group_number: group }).select().single();
  if (error?.code === "23505") return NextResponse.json({ error: "That question is already in the bank." }, { status: 409 });
  if (error) return NextResponse.json({ error: "The question could not be added. Please try again." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
