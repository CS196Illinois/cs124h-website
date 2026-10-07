import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow } from "../../../../lib/sandbox";
import { serverError, signInRequired } from "../../../../lib/apiResponses";
import { getSessionUser } from "../../../../lib/session";

export async function GET() {
  const { netID, role: userRole } = await getSessionUser();
  if (!netID) {
    return signInRequired();
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .select("*")
    .eq("net_id", netID)
    .single();

  if (error) return serverError();

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    return NextResponse.json(await getEffectiveRow(netID, "users", netID, data));
  }
  return NextResponse.json(data);
}
