import { NextResponse } from "next/server";
import { isSandboxRole, getSandboxMode } from "../../../../../lib/sandbox";
import { getManagedEvent } from "../../../../../lib/events";
import { syncEventAttendance } from "../../../../../lib/eventAttendanceSync";
import { serverError, signInRequired } from "../../../../../lib/apiResponses";
import { getSessionUser } from "../../../../../lib/session";

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

// Manual fallback for the automatic post-check-in sync - lets staff force a
// fresh write to the sheet (e.g. after the automatic sync failed, or right
// before pulling up the sheet for a meeting).
export async function POST(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();
  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
  }

  const { id } = await params;
  if (!(await getManagedEvent(id, netID, userRole))) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }

  // A sandboxed event only exists in this user's overlay - there's no real
  // sheet to write, and its check-ins live in the overlay too.
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    return NextResponse.json({ success: true, skipped: "sandbox" });
  }

  try {
    await syncEventAttendance(id);
  } catch (e) {
    return serverError();
  }
  return NextResponse.json({ success: true });
}
