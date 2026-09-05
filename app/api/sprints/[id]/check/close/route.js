import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../../../lib/supabaseServer";
import { table } from "../../../../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../../../../lib/sandbox";
import { resolveActorGroup } from "../route";

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;
  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { groupNumber, error, status } = await resolveActorGroup(userRole, netID, body.group_number);
  if (error) return NextResponse.json({ error }, { status: status ?? 400 });

  const now = new Date().toISOString();

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const { data: realRows } = await supabaseServer
      .from(table("sprintCheckWindows")).select("*").eq("sprint_id", id).eq("group_number", groupNumber);
    const merged = await mergeSandboxRows(
      netID, "sprintCheckWindows", realRows ?? [],
      (row) => row.sprint_id === id && row.group_number === groupNumber,
    );
    const existing = merged[0];
    const rowPk = existing ? String(existing.id) : randomUUID();
    const fullRow = {
      ...(existing ?? { sprint_id: id, group_number: groupNumber, opened_at: null, opened_by: null }),
      id: rowPk, is_open: false, closed_at: now, closed_by: netID,
    };
    await sandboxWrite(netID, "sprintCheckWindows", existing ? "update" : "insert", rowPk, fullRow);
    return NextResponse.json(fullRow);
  }

  const { data, error: dbError } = await supabaseServer
    .from(table("sprintCheckWindows"))
    .upsert(
      { sprint_id: id, group_number: groupNumber, is_open: false, closed_at: now, closed_by: netID },
      { onConflict: "sprint_id,group_number" },
    )
    .select()
    .single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
