import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../../../lib/sandbox";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await supabaseServer
    .from(table("sprintCompletions"))
    .select("*")
    .eq("sprint_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprintCompletions", rows, (row) => row.sprint_id === id);
  }
  return NextResponse.json(rows);
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const userNetId = session?.user?.netID;

  if (!["pm", "head_pm", "course_lead", "lead_web_dev", "web_dev"].includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.student_net_id) {
    return NextResponse.json({ error: "student_net_id is required" }, { status: 400 });
  }

  if (userRole === "pm") {
    const { data: pm } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", userNetId)
      .single();
    const { data: student } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", body.student_net_id)
      .single();
    if (!pm || !student || pm.group_number !== student.group_number) {
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const userNetId = session?.user?.netID;

  if (!["pm", "head_pm", "course_lead", "lead_web_dev", "web_dev"].includes(userRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const studentNetId = searchParams.get("student_net_id");
  if (!studentNetId) {
    return NextResponse.json({ error: "student_net_id query param required" }, { status: 400 });
  }

  if (userRole === "pm") {
    const { data: pm } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", userNetId)
      .single();
    const { data: student } = await supabaseServer
      .from(table("users"))
      .select("group_number")
      .eq("net_id", studentNetId)
      .single();
    if (!pm || !student || pm.group_number !== student.group_number) {
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
