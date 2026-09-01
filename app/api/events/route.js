import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows, sandboxWrite } from "../../../lib/sandbox";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from(table("events"))
    .select("id, title, description, location, presenter, start_time, check_in_open, check_in_opened_at, created_by, created_at, point_value, sheet_synced_at, sheet_sync_error")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "events", rows, () => true);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return NextResponse.json(rows);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!STAFF_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, location, presenter, start_time, end_time } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // end_time is required by the DB - default to 1 hour after start_time, or now + 1h
  const resolvedEndTime = end_time || (
    start_time
      ? new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString()
  );

  const row = {
    title: title.trim(),
    description: description?.trim() || null,
    location: location?.trim() || null,
    presenter: presenter?.trim() || null,
    start_time: start_time || null,
    end_time: resolvedEndTime,
    created_by: netID,
  };

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const fullRow = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      point_value: 0,
      check_in_open: false,
      check_in_opened_at: null,
      is_active: true,
      checked_in_students: [],
      qr_code_secret: null,
      join_link: null,
      ...row,
    };
    await sandboxWrite(netID, "events", "insert", fullRow.id, fullRow);
    return NextResponse.json(fullRow, { status: 201 });
  }

  const { data, error } = await supabaseServer
    .from(table("events"))
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
