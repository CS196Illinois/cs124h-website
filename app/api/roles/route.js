import { NextResponse } from "next/server";
import { ALL_ROLES, MANAGEABLE_BY } from "../../../lib/roles";
import { signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";

export async function GET(request) {
  const { role: userRole } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const manageable = new URL(request.url).searchParams.get("manageable") === "true";

  if (manageable) {
    const ids = MANAGEABLE_BY[userRole] ?? [];
    return NextResponse.json(ALL_ROLES.filter((r) => ids.includes(r.id)));
  }

  return NextResponse.json(ALL_ROLES);
}
