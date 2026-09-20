import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../../../lib/sandbox";
import { isSprintVisibleToRole } from "../../../../../lib/sprintVisibility";
import { isPmViewRole } from "../../../../../lib/roles";
import { groupStudentIds } from "../../../../../lib/groupScope";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  const { id } = await params;
  const { data: sprint } = await supabaseServer.from(table("sprints")).select("start_date").eq("id", id).maybeSingle();
  if (!sprint || !isSprintVisibleToRole(sprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });
  const { data, error } = await supabaseServer
    .from(table("sprintCompletions"))
    .select("*")
    .eq("sprint_id", id);
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });

  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprintCompletions", rows, (row) => row.sprint_id === id);
  }
  if (userRole === "student") rows = rows.filter((row) => row.student_net_id === netID);
  if (isPmViewRole(userRole)) {
    const visible = new Set(await groupStudentIds(netID, userRole));
    rows = rows.filter((row) => visible.has(row.student_net_id));
  }
  return NextResponse.json(rows);
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const userNetId = session?.user?.netID;

  if (!["pm", "head_pm", "course_lead", "lead_web_dev", "web_dev"].includes(userRole)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const { id } = await params;
  const { data: sprint } = await supabaseServer.from(table("sprints")).select("start_date").eq("id", id).maybeSingle();
  if (!sprint || !isSprintVisibleToRole(sprint, userRole)) return NextResponse.json({ error: "This sprint is not available yet." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body?.student_net_id) {
    return NextResponse.json({ error: "Please choose a student." }, { status: 400 });
  }

  if (isPmViewRole(userRole)) {
    if (!(await groupStudentIds(userNetId, userRole)).includes(body.student_net_id)) {
      return NextResponse.json({ error: "Student not in your group" }, { status: 403 });
    }
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(userNetId)) !== "off") {
    // sprint_id + student_net_id is the real upsert key (matches the real
    // table's unique constraint), not the surrogate id - find any existing
    // row (real or already-sandboxed) under that key first, so a re-mark
    // updates it in place instead of creating a duplicate overlay entry.
    const { data: realRows } = await supabaseServer
      .from(table("sprintCompletions")).select("*").eq("sprint_id", id).eq("student_net_id", body.student_net_id);
    const merged = await mergeSandboxRows(
      userNetId, "sprintCompletions", realRows ?? [],
      (row) => row.sprint_id === id && row.student_net_id === body.student_net_id
    );
    const existing = merged[0];
    const rowPk = existing ? String(existing.id) : randomUUID();
    const fullRow = {
      id: rowPk, sprint_id: id, student_net_id: body.student_net_id,
      marked_by: userNetId, completed_at: new Date().toISOString(),
    };
    await sandboxWrite(userNetId, "sprintCompletions", existing ? "update" : "insert", rowPk, fullRow);
    return NextResponse.json(fullRow, { status: 201 });
  }

  const { data, error } = await supabaseServer
    .from(table("sprintCompletions"))
    .upsert(
      { sprint_id: id, student_net_id: body.student_net_id, marked_by: userNetId, completed_at: new Date().toISOString() },
      { onConflict: "sprint_id,student_net_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const userNetId = session?.user?.netID;

  if (!["pm", "head_pm", "course_lead", "lead_web_dev", "web_dev"].includes(userRole)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const studentNetId = searchParams.get("student_net_id");
  if (!studentNetId) {
    return NextResponse.json({ error: "Please choose a student to remove." }, { status: 400 });
  }

  if (isPmViewRole(userRole)) {
    if (!(await groupStudentIds(userNetId, userRole)).includes(studentNetId)) {
      return NextResponse.json({ error: "Student not in your group" }, { status: 403 });
    }
  }

  if (isSandboxRole(userRole) && (await getSandboxMode(userNetId)) !== "off") {
    const { data: realRows } = await supabaseServer
      .from(table("sprintCompletions")).select("*").eq("sprint_id", id).eq("student_net_id", studentNetId);
    const merged = await mergeSandboxRows(
      userNetId, "sprintCompletions", realRows ?? [],
      (row) => row.sprint_id === id && row.student_net_id === studentNetId
    );
    if (merged[0]) {
      await sandboxWrite(userNetId, "sprintCompletions", "delete", String(merged[0].id), null);
    }
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabaseServer
    .from(table("sprintCompletions"))
    .delete()
    .eq("sprint_id", id)
    .eq("student_net_id", studentNetId);
  if (error) return NextResponse.json({ error: "Something went wrong while processing your request. Please try again. If the problem continues, contact your course staff." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
