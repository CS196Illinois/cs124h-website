import { NextResponse } from "next/server";
import { getCheckInEvent } from "../../../../../lib/events";
import { syncEventAttendance } from "../../../../../lib/eventAttendanceSync";
import { serverError, signInRequired } from "../../../../../lib/apiResponses";
import { getSessionUser } from "../../../../../lib/session";
import { STAFF_ROLES } from "../../../../../lib/roles";


// Manual fallback for the automatic post-check-in sync - lets staff force a
// fresh write to the sheet (e.g. after the automatic sync failed, or right
// before pulling up the sheet for a meeting).
export async function POST(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();
  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
  }

  const { id } = await params;
  if (!(await getCheckInEvent(id, netID, userRole))) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }

  try {
    await syncEventAttendance(id);
  } catch (e) {
    return serverError();
  }
  return NextResponse.json({ success: true });
}
