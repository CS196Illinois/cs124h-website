import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { serverError, signInRequired } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

export async function GET() {
  const { netID } = await getSessionUser();
  if (!netID) {
    return signInRequired();
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .select("*")
    .eq("net_id", netID)
    .single();

  if (error) return serverError();

  return NextResponse.json(data);
}
