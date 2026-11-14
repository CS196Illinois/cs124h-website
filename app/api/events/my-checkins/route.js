import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { serverError, signInRequired } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

// Returns the list of event IDs the current user has checked into
export async function GET() {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const { data, error } = await supabaseServer
    .from(table("eventCheckins"))
    .select("event_id, checked_in_at")
    .eq("net_id", netID)
    .order("checked_in_at", { ascending: false });

  if (error) return serverError();

  return NextResponse.json(data);
}
