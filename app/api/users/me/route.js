import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow } from "../../../../lib/sandbox";

export async function GET() {
  const session = await getServerSession(authOptions);
  const netID = session?.user?.netID;
  const userRole = session?.user?.role;
  if (!netID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from(table("users"))
    .select("*")
    .eq("net_id", netID)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    return NextResponse.json(await getEffectiveRow(netID, "users", netID, data));
  }
  return NextResponse.json(data);
}
