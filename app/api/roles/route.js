import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { ALL_ROLES, MANAGEABLE_BY } from "../../../lib/roles";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

  if (!userRole || userRole === "error") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manageable = new URL(request.url).searchParams.get("manageable") === "true";

  if (manageable) {
    const ids = MANAGEABLE_BY[userRole] ?? [];
    return NextResponse.json(ALL_ROLES.filter((r) => ids.includes(r.id)));
  }

  return NextResponse.json(ALL_ROLES);
}
