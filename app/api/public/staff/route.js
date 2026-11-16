import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { serverError } from "../../../../lib/apiResponses";
import { semesterSortKey } from "../../../../lib/term";

// Public route - no auth required. The course staff page is intentionally
// visible to anyone, logged in or not.
export async function GET() {
  const { data, error } = await supabaseServer
    .from(table("staff"))
    .select("*")
    .order("member_order", { ascending: true });

  if (error) return serverError();
  // Newest semester first, worked out from the label ("Fall 2026"), so a new
  // semester needs no ordering number.
  const rows = [...(data ?? [])].sort((a, b) => semesterSortKey(b.semester) - semesterSortKey(a.semester));
  return NextResponse.json(rows);
}
