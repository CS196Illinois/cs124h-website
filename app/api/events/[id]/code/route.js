import { NextResponse } from "next/server";
import { getCheckInEvent, checkInWindowClosed } from "../../../../../lib/events";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import crypto from "crypto";
import { signInRequired } from "../../../../../lib/apiResponses";
import { getSessionUser } from "../../../../../lib/session";
import { STAFF_ROLES } from "../../../../../lib/roles";

export const WINDOW_MS = 30_000; // 30-second rotation

/**
 * The key codes are derived from. ATTENDANCE_SECRET if set, otherwise the
 * auth secret every deployment already has. Never a value from the source
 * code: anyone who can read the repo could then compute valid codes.
 */
function attendanceSecret() {
  const secret = process.env.ATTENDANCE_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("Set ATTENDANCE_SECRET or NEXTAUTH_SECRET to issue check-in codes.");
  return "local-development-only";
}

/**
 * Derives a 6-digit code from an event ID and a time window index.
 * Never stored in the DB - recomputed on every request.
 */
export function deriveCode(eventId, windowOffset = 0) {
  const secret = attendanceSecret();
  const window = Math.floor(Date.now() / WINDOW_MS) + windowOffset;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${eventId}:${window}`);
  const num = parseInt(hmac.digest("hex").slice(0, 8), 16) % 1_000_000;
  return num.toString().padStart(6, "0");
}

// Staff only - returns the current code + seconds until rotation
export async function GET(request, { params }) {
  const caller = await getSessionUser();
  if (!STAFF_ROLES.includes(caller.role)) {
    return signInRequired(403);
  }

  const { id } = await params;
  const netID = caller.netID;

  const event = await getCheckInEvent(id, netID, caller.role, "id, title, created_by, end_time, check_in_open");
  if (!event) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }
  if (!event.check_in_open) {
    return NextResponse.json({ error: "Check-in is not open for this event." }, { status: 400 });
  }
  if (checkInWindowClosed(event)) {
    await supabaseServer.from(table("events")).update({ check_in_open: false }).eq("id", id).eq("check_in_open", true);
    return NextResponse.json({ error: "This event has ended and its check-in window has closed." }, { status: 400 });
  }

  const code = deriveCode(id);
  // Handed over up front so the client can swap to it the instant the
  // window rotates, with no round trip (and therefore no visible gap) at
  // the exact moment the current code stops being valid.
  const nextCode = deriveCode(id, 1);
  const expiresInMs = WINDOW_MS - (Date.now() % WINDOW_MS);
  const expiresIn = Math.ceil(expiresInMs / 1000);
  return NextResponse.json({ code, nextCode, expiresIn, expiresInMs });
}
