import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { serverError } from "../../../../lib/apiResponses";

// Public route - no auth required. The hall of fame page is intentionally
// visible to anyone, logged in or not.
export async function GET() {
  const { data, error } = await supabaseServer
    .from(table("projects"))
    .select("*")
    .order("semester_order", { ascending: true })
    .order("project_order", { ascending: true });

  if (error) return serverError();
  return NextResponse.json(data ?? []);
}
