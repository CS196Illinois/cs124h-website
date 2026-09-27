import { CHECK_MANAGE_ROLES } from "../../../../../lib/sprintCheckAccess";
import { getUserGroup, groupSprintChecks, fetchGroupChecks, applyGroupQuestions } from "../../../../../lib/groupSprintChecks";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows } from "../../../../../lib/sandbox";
import { resolveMaxScore } from "../../../../../lib/sprintChecks";
import { isPmViewRole } from "../../../../../lib/roles";
import { isSprintVisibleToRole } from "../../../../../lib/sprintVisibility";

async function fetchWindows(sprintId, netID, userRole, groupNumber) {
  if (groupNumber === null) return [];
  let query = supabaseServer.from(table("sprintCheckWindows")).select("*").eq("sprint_id", sprintId);
  if (groupNumber !== undefined) query = query.eq("group_number", groupNumber);
  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprintCheckWindows", rows, (row) => row.sprint_id === sprintId && (groupNumber === undefined || row.group_number === groupNumber));
  }
  return rows;
}

async function fetchSubmissions(sprintId, netID, userRole, studentNetIDs) {
  if (studentNetIDs?.length === 0) return [];
  let query = supabaseServer.from(table("actionItems")).select("*").eq("sprint_id", sprintId);
  if (studentNetIDs) query = query.in("net_id", studentNetIDs);
  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "actionItems", rows, (row) => row.sprint_id === sprintId && (!studentNetIDs || studentNetIDs.includes(row.net_id)));
  }
  return rows;
}

// `item` is the full action_items row when submitted, shaped exactly as
// GradeActionItemModal expects - so a roster's "Grade" button can hand it
// the row directly with no extra fetch.
function rosterFor(students, submissionsByNetID) {
  return students.map((s) => {
    const sub = submissionsByNetID.get(s.net_id);
    return { net_id: s.net_id, name: s.name, submitted: !!sub, item: sub ?? null };
  });
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  const { id } = await params;
  const { data: baseSprint } = await supabaseServer.from(table("sprints")).select("*").eq("id", id).maybeSingle();
  if (!baseSprint) return NextResponse.json({ error: "We could not find that sprint. It may have been removed or is not available yet." }, { status: 404 });
  if (!isSprintVisibleToRole(baseSprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });

  const groupScoped = userRole === "student" || isPmViewRole(userRole);
  const groupNumber = groupScoped ? await getUserGroup(netID) : undefined;
  const [sprint] = groupScoped
    ? await groupSprintChecks([baseSprint], groupNumber, netID, userRole)
    : [baseSprint];
  const hasCheck = Array.isArray(sprint.check_questions) && sprint.check_questions.length > 0;
  const maxScore = resolveMaxScore(sprint);

  if (userRole === "student") {
    const [windows, submissions] = await Promise.all([fetchWindows(id, netID, userRole, groupNumber), fetchSubmissions(id, netID, userRole, [netID])]);
    const myWindow = windows.find((w) => w.group_number === groupNumber);
    const mine = submissions.find((s) => s.net_id === netID);
    if (!hasCheck && !mine) return NextResponse.json({ hasCheck: false });
    const isOpen = !!myWindow?.is_open;
    return NextResponse.json({
      hasCheck: true,
      isOpen,
      questions: mine ? (mine.additional_info?.questions ?? sprint.check_questions) : isOpen ? sprint.check_questions : null,
      maxScore,
      mySubmission: mine
        ? { answers: mine.additional_info?.answers ?? [], grade: mine.grade, gradeNote: mine.grade_note }
        : null,
    });
  }

  if (isPmViewRole(userRole)) {
    // Unassigned PMs get no course-wide roster or submissions.
    const { data: students, error } = groupNumber == null ? { data: [] } : await supabaseServer
      .from(table("users")).select("net_id, name").eq("role", "STUDENT").eq("group_number", groupNumber);
    if (error) throw error;
    const [windows, submissions] = await Promise.all([
      fetchWindows(id, netID, userRole, groupNumber),
      fetchSubmissions(id, netID, userRole, (students ?? []).map((s) => s.net_id)),
    ]);
    return NextResponse.json({
      hasCheck, groupNumber, isOpen: !!windows[0]?.is_open,
      questions: hasCheck ? sprint.check_questions : null,
      maxScore,
      roster: rosterFor(students ?? [], new Map(submissions.map((s) => [s.net_id, s]))),
    });
  }

  if (CHECK_MANAGE_ROLES.includes(userRole)) {
    const [windows, submissions, { data: students, error }, groupChecks] = await Promise.all([
      fetchWindows(id, netID, userRole),
      fetchSubmissions(id, netID, userRole),
      supabaseServer.from(table("users")).select("net_id, name, group_number").eq("role", "STUDENT"),
      fetchGroupChecks([id], undefined, netID, userRole),
    ]);
    if (error) throw error;
    const studentsByGroup = new Map();
    for (const student of students ?? []) {
      if (student.group_number == null) continue;
      if (!studentsByGroup.has(student.group_number)) studentsByGroup.set(student.group_number, []);
      studentsByGroup.get(student.group_number).push(student);
    }
    const submissionsByNetID = new Map(submissions.map((s) => [s.net_id, s]));
    const windowsByGroup = new Map(windows.map((w) => [w.group_number, w]));
    const questionsByGroup = new Map(groupChecks.map((c) => [c.group_number, c.additional_questions]));
    const groups = [...studentsByGroup.keys()].sort((a, b) => a - b).map((g) => ({
      questions: applyGroupQuestions(sprint, questionsByGroup.get(g)).check_questions ?? [],
      groupNumber: g,
      isOpen: !!windowsByGroup.get(g)?.is_open,
      roster: rosterFor(studentsByGroup.get(g), submissionsByNetID),
    }));
    return NextResponse.json({ hasCheck: hasCheck || groups.some((g) => g.questions.length > 0), questions: hasCheck ? sprint.check_questions : null, maxScore, groups });
  }

  return NextResponse.json({ error: "Please sign in to continue." }, { status: 403 });
}
