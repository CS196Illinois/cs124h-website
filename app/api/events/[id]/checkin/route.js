import { NextResponse, after } from "next/server";
import { supabaseServer } from "../../../../../lib/supabaseServer";
import { table } from "../../../../../lib/tables";
import { deriveCode } from "../code/route";
import { getCheckInEvent } from "../../../../../lib/events";
import { syncEventAttendance } from "../../../../../lib/eventAttendanceSync";
import { audienceMatches, checkInWindowClosed } from "../../../../../lib/events";
import { serverError, signInRequired } from "../../../../../lib/apiResponses";
import { getSessionUser } from "../../../../../lib/session";
import { createHash } from "crypto";
import { STAFF_ROLES } from "../../../../../lib/roles";

// Check-in attempts allowed per person per event per hour. Generous for
// mistyped codes; far too few to guess a 6-digit code.
const MAX_ATTEMPTS_PER_HOUR = 20;

/** True when this person is still under the attempt limit for this event. */
async function underAttemptLimit(netID, eventId) {
  const bucket_key = createHash("sha256").update(`checkin:${netID}:${eventId}`).digest("hex");
  const { data, error } = await supabaseServer.rpc(table("supportRateLimit"), { bucket_key, max_requests: MAX_ATTEMPTS_PER_HOUR });
  // If the limiter itself is down, don't lock a room full of students out.
  if (error) { console.error("check-in rate limit unavailable:", error.message); return true; }
  return Boolean(data);
}


// The event's creator, hosts, or a course lead: view its attendee list
export async function GET(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();
  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
  }

  const { id } = await params;
  if (!(await getCheckInEvent(id, netID, userRole))) {
    return NextResponse.json({ error: "That event could not be found, or you do not have permission to manage it." }, { status: 403 });
  }
  const { data, error } = await supabaseServer
    .from(table("eventCheckins"))
    .select("net_id, checked_in_at")
    .eq("event_id", id)
    .order("checked_in_at", { ascending: true });

  if (error) return serverError();

  return NextResponse.json(data);
}

// Any authenticated user: submit a check-in code
export async function POST(request, { params }) {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const { id } = await params;
  const { code } = (await request.json().catch(() => null)) || {};

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Please enter the check-in code." }, { status: 400 });
  }

  // Verify event exists and check-in is currently open
  let { data: event, error: eventError } = await supabaseServer
    .from(table("events"))
    .select("id, title, end_time, check_in_open, audience_type, audience_values")
    .eq("id", id)
    .maybeSingle();
  if (eventError && (eventError.code === "PGRST204" || eventError.code === "42703")) {
    ({ data: event } = await supabaseServer.from(table("events")).select("id, title, end_time, check_in_open").eq("id", id).maybeSingle());
    if (event) event = { ...event, audience_type: "all", audience_values: [] };
  }

  if (!event) {
    return NextResponse.json({ error: "We could not find that event. It may have been removed." }, { status: 404 });
  }
  if (checkInWindowClosed(event)) {
    await supabaseServer.from(table("events")).update({ check_in_open: false }).eq("id", id).eq("check_in_open", true);
    return NextResponse.json({ error: "This event has ended and its check-in window has closed." }, { status: 400 });
  }
  if (!event.check_in_open) {
    return NextResponse.json({ error: "Check-in is not open for this event." }, { status: 400 });
  }
  const { data: viewer } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
  if (!audienceMatches(event, { netID, role: userRole, groupNumber: viewer?.group_number ?? null })) {
    return NextResponse.json({ error: "You are not included in this event's audience." }, { status: 403 });
  }

  if (!(await underAttemptLimit(netID, id))) {
    return NextResponse.json({ error: "Too many check-in attempts. Ask the event's host to check you in." }, { status: 429 });
  }

  // Validate against current window and previous window (grace period for slow typers)
  const submitted = code.trim().replace(/\s/g, "");
  const valid =
    submitted === deriveCode(id, 0) ||
    submitted === deriveCode(id, -1);

  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect code. Make sure you're reading the latest code from the screen." },
      { status: 400 }
    );
  }

  // Insert - the unique constraint on (event_id, net_id) prevents double check-in
  const { error: insertError } = await supabaseServer
    .from(table("eventCheckins"))
    .insert({ event_id: id, net_id: netID });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You've already checked in to this event." },
        { status: 409 }
      );
    }
    return serverError();
  }

  // Fire-and-forget: after() keeps this running past the response instead of
  // getting killed the instant NextResponse.json() returns (which a bare
  // un-awaited promise would risk on serverless). Never blocks the student's
  // check-in on Sheets being slow or down - a failed sync just means the
  // sheet is stale until the next check-in or a manual "Sync now".
  after(() => syncEventAttendance(id).catch((e) => console.error(`checkin sheet sync failed for event ${id}:`, e.message)));

  return NextResponse.json({ success: true, event_title: event.title }, { status: 201 });
}
