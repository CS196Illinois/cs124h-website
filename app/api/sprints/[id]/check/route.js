import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows } from "../../../../../lib/sandbox";
import { resolveMaxScore } from "../../../../../lib/sprintChecks";
import { isPmViewRole } from "../../../../../lib/roles";

const MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

/**
 * Which group a PM/manager may open or close the check for - a PM (or a web dev
 * assigned to a group) is always their own group; a manager names one. Shared
 * by open/ and close/.
 */
export async function resolveActorGroup(userRole, netID, bodyGroupNumber) {
  if (isPmViewRole(userRole)) {
    const { data: me } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
    if (me?.group_number != null) return { groupNumber: me.group_number };
    if (userRole === "pm") return { error: "You have no group assigned" };
  }
  if (MANAGE_ROLES.includes(userRole)) {
    const g = Number(bodyGroupNumber);
    if (!Number.isFinite(g)) return { error: "group_number is required" };
    return { groupNumber: g };
  }
  return { error: "Insufficient permissions", status: 403 };
}

async function fetchWindows(sprintId, netID, userRole) {
  const { data } = await supabaseServer.from(table("sprintCheckWindows")).select("*").eq("sprint_id", sprintId);
  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprintCheckWindows", rows, (row) => row.sprint_id === sprintId);
  }
  return rows;
}

async function fetchSubmissions(sprintId, netID, userRole) {
  const { data } = await supabaseServer.from(table("actionItems")).select("*").eq("sprint_id", sprintId);
  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "actionItems", rows, (row) => row.sprint_id === sprintId);
  }
  return rows;
}

// `item` is the full action_items row when submitted, shaped exactly as
// GradeActionItemModal expects - so a roster's "Grade" button can hand it
// the row directly with no extra fetch.
function rosterFor(students, submissions) {
  return students.map((s) => {
    const sub = submissions.find((x) => x.net_id === s.net_id);
    return { net_id: s.net_id, name: s.name, submitted: !!sub, item: sub ?? null };
  });
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data: sprint } = await supabaseServer.from(table("sprints")).select("*").eq("id", id).maybeSingle();
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  const hasCheck = Array.isArray(sprint.check_questions) && sprint.check_questions.length > 0;
  const maxScore = resolveMaxScore(sprint);

  if (userRole === "student") {
    if (!hasCheck) return NextResponse.json({ hasCheck: false });
    const { data: me } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
    const [windows, submissions] = await Promise.all([fetchWindows(id, netID, userRole), fetchSubmissions(id, netID, userRole)]);
    const myWindow = windows.find((w) => w.group_number === me?.group_number);
    const mine = submissions.find((s) => s.net_id === netID);
    const isOpen = !!myWindow?.is_open;
    return NextResponse.json({
      hasCheck: true,
      isOpen,
      questions: isOpen || mine ? sprint.check_questions : null,
      maxScore,
      mySubmission: mine
        ? { answers: mine.additional_info?.answers ?? [], grade: mine.grade, gradeNote: mine.grade_note }
        : null,
    });
  }

  if (isPmViewRole(userRole)) {
    const { data: me } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
    const groupNumber = me?.group_number;
    // A web dev with no group isn't acting as a PM - fall through to the
    // manager all-groups view below.
    if (userRole === "pm" || groupNumber != null) {
      const [windows, submissions] = await Promise.all([fetchWindows(id, netID, userRole), fetchSubmissions(id, netID, userRole)]);
      const myWindow = windows.find((w) => w.group_number === groupNumber);
      let roster = [];
      if (groupNumber != null) {
        const { data: students } = await supabaseServer
          .from(table("users")).select("net_id, name").eq("role", "STUDENT").eq("group_number", groupNumber);
        roster = rosterFor(students ?? [], submissions);
      }
      return NextResponse.json({
        hasCheck,
        groupNumber,
        isOpen: !!myWindow?.is_open,
        questions: hasCheck ? sprint.check_questions : null,
        maxScore,
        roster,
      });
    }
  }

  if (MANAGE_ROLES.includes(userRole)) {
    const [windows, submissions, { data: students }] = await Promise.all([
      fetchWindows(id, netID, userRole),
      fetchSubmissions(id, netID, userRole),
      supabaseServer.from(table("users")).select("net_id, name, group_number").eq("role", "STUDENT"),
    ]);
    const groupNumbers = [...new Set((students ?? []).map((s) => s.group_number).filter((g) => g != null))].sort((a, b) => a - b);
    const groups = groupNumbers.map((g) => ({
      groupNumber: g,
      isOpen: !!windows.find((w) => w.group_number === g)?.is_open,
      roster: rosterFor((students ?? []).filter((s) => s.group_number === g), submissions),
    }));
    return NextResponse.json({ hasCheck, questions: hasCheck ? sprint.check_questions : null, maxScore, groups });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
