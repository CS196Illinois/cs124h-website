import { getUserGroup, groupSprintChecks } from "../../../../../../lib/groupSprintChecks";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../../lib/supabaseServer";
import { table } from "../../../../../../lib/tables";
import { resolveMaxScore, formatCheckAnswers } from "../../../../../../lib/sprintChecks";
import { isSprintVisibleToRole } from "../../../../../../lib/sprintVisibility";

// Student only - web_dev/lead_web_dev sandbox previews never reach here,
// since neither role can itself be "student".
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (userRole !== "student") {
    return NextResponse.json({ error: "Only students can submit an understanding check" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : null;

  const { data: baseSprint } = await supabaseServer.from(table("sprints")).select("*").eq("id", id).maybeSingle();
  if (!baseSprint || !isSprintVisibleToRole(baseSprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });
  const groupNumber = await getUserGroup(netID);
  const [sprint] = await groupSprintChecks([baseSprint], groupNumber, netID, userRole);
  const questions = Array.isArray(sprint?.check_questions) ? sprint.check_questions : [];
  if (!questions.length) {
    return NextResponse.json({ error: "This sprint does not have an understanding check yet." }, { status: 400 });
  }
  if (!answers || answers.length !== questions.length || answers.some((a) => !String(a ?? "").trim())) {
    return NextResponse.json({ error: "Please answer every question before submitting." }, { status: 400 });
  }

  const { data: window } = await supabaseServer
    .from(table("sprintCheckWindows"))
    .select("*")
    .eq("sprint_id", id)
    .eq("group_number", groupNumber ?? -1)
    .maybeSingle();
  if (!window?.is_open) {
    return NextResponse.json({ error: "This check is closed right now. Ask your PM to open it." }, { status: 403 });
  }

  const now = new Date().toISOString();
  // The production action_items constraint requires completion_date to be
  // strictly after created_at, so leave a small margin instead of using the
  // same timestamp for both fields.
  const createdAt = new Date(Date.now() - 1000).toISOString();
  const row = {
    net_id: netID,
    title: `Sprint ${sprint.number} Understanding Check`,
    description: formatCheckAnswers(questions, answers),
    // Set created_at explicitly. Relying on Postgres' default can put it a
    // few milliseconds after this completion timestamp and reject the row.
    created_at: createdAt,
    is_done: true,
    completion_date: now,
    assigned_by: window.opened_by,
    is_gradable: true,
    max_score: resolveMaxScore(sprint),
    batch_id: sprint.id,
    sprint_id: id,
    additional_info: { kind: "sprint_check", sprint_id: id, questions, answers },
  };

  const { data, error } = await supabaseServer.from(table("actionItems")).insert(row).select().single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You already submitted this understanding check. Refresh the page to view your saved answers." }, { status: 409 });
    }
    if (error.code === "23514") {
      return NextResponse.json({
        error: "We could not save your answers. Please refresh and try again. If the problem continues, contact your course staff and mention reference SPRINT_CHECK_SAVE.",
        code: "SPRINT_CHECK_SAVE",
      }, { status: 500 });
    }
    return NextResponse.json({ error: "We couldn't save your understanding check right now. Please try again. If the problem continues, contact your course staff.", code: "SPRINT_CHECK_SAVE_UNKNOWN" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
