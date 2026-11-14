import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { canAdminEvents, validateEventAudience, validateEventHosts, audienceMatches, checkInWindowClosed, eventHosts } from "../../../lib/events";
import { EVENT_TEXT_MAX } from "../../../lib/fieldRules";
import { invalidInput, serverError, signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";
import { isEventCategory } from "../../../lib/eventCategories";
import { SITE } from "../../../lib/siteConfig";

// A weekly series is capped so a typo in the end date can't create hundreds of events.
const MAX_OCCURRENCES = 20;
const WEEK_MS = 7 * 86_400_000;

/** Minutes the course time zone is ahead of UTC at `ms` (e.g. -360 for CST). */
function courseOffsetMinutes(ms) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** `ms` moved by `weeks` weeks, keeping the same local clock time across DST changes. */
function addWeeksLocal(ms, weeks) {
  const shifted = ms + weeks * WEEK_MS;
  return shifted + (courseOffsetMinutes(ms) - courseOffsetMinutes(shifted)) * 60_000;
}

const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm"];

export async function GET(request) {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  // Attendance: eligible open events plus the viewer's attendance history.
  // Events: created, hosted, or joined events. Lead web devs and course leads see all.
  const scope = new URL(request.url).searchParams.get("scope") || "mine";

  const columns = "id, title, description, location, presenter, start_time, end_time, check_in_open, check_in_opened_at, created_by, created_at, point_value, sheet_synced_at, sheet_sync_error, audience_type, audience_values";
  let { data, error } = await supabaseServer
    .from(table("events"))
    .select(`${columns}, hosts`)
    .order("created_at", { ascending: false });
  // Before the hosts migration runs, list events without them.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ data, error } = await supabaseServer.from(table("events")).select(columns).order("created_at", { ascending: false }));
  }

  if (error) return serverError();

  // A GET never writes: an expired window just reads as closed here.
  let rows = data.map((event) => event.check_in_open && checkInWindowClosed(event) ? { ...event, check_in_open: false } : event);

  const { data: viewer, error: viewerError } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
  if (viewerError) return NextResponse.json({ error: "Your event access could not be checked. Please try again." }, { status: 503 });
  const viewerGroup = viewer?.group_number ?? null;
  if (scope === "checkin" || !canAdminEvents(userRole)) {
    const { data: mine, error: checkinError } = await supabaseServer
      .from(table("eventCheckins")).select("id, event_id, net_id").eq("net_id", netID);
    if (checkinError) return NextResponse.json({ error: "Your joined events could not be loaded. Please try again." }, { status: 503 });
    const attendedIds = new Set((mine ?? []).map((r) => r.event_id));
    rows = rows.filter((e) => attendedIds.has(e.id) || (scope === "checkin"
      ? e.check_in_open && audienceMatches(e, { netID, role: userRole, groupNumber: viewerGroup })
      : e.created_by === netID || eventHosts(e).includes(netID)));
  }

  return NextResponse.json(rows);
}

export async function POST(request) {
  const { role: userRole, netID } = await getSessionUser();

  if (!STAFF_ROLES.includes(userRole)) {
    return signInRequired(403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidInput();
  const { title, description, location, presenter, start_time, end_time } = body;
  let { audience_type, audience_values = [] } = body;
  if (audience_type === undefined && userRole === "pm") {
    const { data: me, error } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
    if (error) return NextResponse.json({ error: "Your group could not be loaded. Please try again." }, { status: 503 });
    if (me?.group_number == null) return NextResponse.json({ error: "You have no group assigned. Choose an event audience explicitly." }, { status: 400 });
    audience_type = "groups";
    audience_values = [String(me.group_number)];
  }
  audience_type ??= "all";

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Please enter a title." }, { status: 400 });
  }
  const audience = await validateEventAudience(audience_type, audience_values, netID, userRole);
  if (audience.error) return NextResponse.json({ error: audience.error }, { status: audience.status || 400 });
  const cleanAudience = audience.values;
  const hosts = await validateEventHosts(body.hosts ?? [], netID, userRole);
  if (hosts.error) return NextResponse.json({ error: hosts.error }, { status: hosts.status || 400 });

  if ([description, location, presenter].some((value) => value != null && typeof value !== "string")) {
    return NextResponse.json({ error: "Description, location and presenter must be text" }, { status: 400 });
  }
  if ([title, location, presenter].some((value) => typeof value === "string" && value.trim().length > EVENT_TEXT_MAX)) {
    return NextResponse.json({ error: `Title, location and presenter must be ${EVENT_TEXT_MAX} characters or fewer.` }, { status: 400 });
  }
  // start_time is NOT NULL in the database.
  if (typeof start_time !== "string" || !start_time.trim()) {
    return NextResponse.json({ error: "Please choose a start time." }, { status: 400 });
  }
  if ([start_time, end_time].some((value) => value != null && value !== "" && (typeof value !== "string" || !Number.isFinite(Date.parse(value))))) {
    return NextResponse.json({ error: "Please enter a valid event date and time." }, { status: 400 });
  }
  if (start_time && end_time && Date.parse(end_time) <= Date.parse(start_time)) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  // end_time is required by the DB - default to 1 hour after start_time
  const resolvedEndTime = end_time || new Date(Date.parse(start_time) + 60 * 60 * 1000).toISOString();

  if (body.category != null && !isEventCategory(body.category)) {
    return NextResponse.json({ error: "Please choose a valid category." }, { status: 400 });
  }

  // Optional weekly repeat: one event per week, same weekday and time, up to
  // and including this course day.
  let occurrences = 1;
  if (body.repeat_weekly_until != null && body.repeat_weekly_until !== "") {
    const until = typeof body.repeat_weekly_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.repeat_weekly_until)
      ? Date.parse(`${body.repeat_weekly_until}T23:59:59Z`) : NaN;
    if (!Number.isFinite(until)) return NextResponse.json({ error: "Choose a valid date for the last repeat." }, { status: 400 });
    // Compare course days, not instants: the last week counts if it falls on or before that day.
    const startDay = new Intl.DateTimeFormat("en-CA", { timeZone: SITE.timeZone }).format(new Date(start_time));
    const weeks = Math.floor((until - Date.parse(`${startDay}T00:00:00Z`)) / WEEK_MS);
    if (weeks < 0) return NextResponse.json({ error: "The last repeat must be on or after the first event." }, { status: 400 });
    occurrences = weeks + 1;
    if (occurrences > MAX_OCCURRENCES) {
      return NextResponse.json({ error: `A weekly series can have at most ${MAX_OCCURRENCES} events. Choose an earlier last date.` }, { status: 400 });
    }
  }

  const baseRow = {
    title: title.trim(),
    description: description?.trim() || null,
    location: location?.trim() || null,
    presenter: presenter?.trim() || null,
    start_time,
    end_time: resolvedEndTime,
    ...(body.category ? { category: body.category } : {}),
    created_by: netID,
    audience_type,
    audience_values: audience_type === "all" ? [] : cleanAudience,
    // Only sent when set, so events without hosts still save before the hosts migration.
    ...(hosts.values.length ? { hosts: hosts.values } : {}),
  };
  const seriesId = occurrences > 1 ? randomUUID() : null;
  const startMs = Date.parse(start_time);
  const endMs = Date.parse(resolvedEndTime);
  const rows = Array.from({ length: occurrences }, (_, week) => ({
    ...baseRow,
    start_time: new Date(addWeeksLocal(startMs, week)).toISOString(),
    end_time: new Date(addWeeksLocal(endMs, week)).toISOString(),
    ...(seriesId ? { series_id: seriesId } : {}),
  }));

  const missingColumn = (e) => e && (e.code === "PGRST204" || e.code === "42703");
  const insertRows = (list) => supabaseServer.from(table("events")).insert(list).select();
  let { data, error } = await insertRows(rows);

  // Before the categories migration runs, save without category/series_id.
  if (missingColumn(error) && rows.some((r) => "category" in r || "series_id" in r)) {
    ({ data, error } = await insertRows(rows.map(({ category, series_id, ...rest }) => rest)));
  }
  if (missingColumn(error) && audience_type === "all") {
    ({ data, error } = await insertRows(rows.map(({ category, series_id, ...rest }) => ({ ...rest, audience_type: undefined, audience_values: undefined }))));
  }

  if (error) {
    console.error("Event creation failed", { code: error.code, message: error.message });
    const message = error.code === "PGRST204" || error.code === "42703"
      ? "Events need a database update before they can be created. Ask the website administrator to apply the event audience and hosts migrations, then try again."
      : error.code === "23502"
        ? "The event could not be saved because the database requires additional information. Try adding a start time. If it still fails, contact the website administrator."
        : error.code === "23503"
          ? "Your account could not be linked to the event. Refresh the page and try again; if this continues, ask the website administrator to check your roster entry."
          : "The event could not be saved. Please try again. If this continues, contact the website administrator.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const first = [...(data || [])].sort((x, y) => Date.parse(x.start_time) - Date.parse(y.start_time))[0];
  return NextResponse.json({ ...first, series_count: data?.length ?? 1 }, { status: 201 });
}
