/**
 * Course data shared by the home, schedule, and assignments pages: who is
 * viewing, and the sprints, MPs, and events they may see. Every loader
 * swallows errors and returns an empty result, so an outage (or a table that
 * hasn't been migrated yet) just empties a section instead of breaking a page.
 */
import { getSupabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { courseTodayISO } from "./dateFormat";
import { getSessionUser } from "./session";
import { audienceMatches } from "./eventAudience";
import { isSprintVisibleToRole } from "./sprintVisibility";
import { SITE } from "./siteConfig";
import { eventCategoryLabel } from "./eventCategories";

const DAY_MS = 86_400_000;

// ─── Dates ──────────────────────────────────────────────────────
// Sprint dates are calendar days ("2026-11-09"). Event and MP times are
// timestamps, shown in the course time zone.

/** The course calendar day (YYYY-MM-DD) of a timestamp. */
export function courseDayOf(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** "2026-11-09" + 3 → "2026-11-12" */
export function addDays(isoDay, days) {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from one course day to another. */
export function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);
}

/** Epoch ms of 11:59 PM on a course day (a sprint's deadline), in the course time zone. */
export function endOfCourseDay(isoDay) {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${isoDay}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "Z";
  return Date.parse(`${isoDay}T23:59:00${offset}`);
}

const dayDate = (isoDay) => new Date(`${isoDay}T00:00:00Z`);

/** Format a course day: formatDay("2026-11-15", { weekday: "long" }) → "Sunday". */
export function formatDay(isoDay, options) {
  return dayDate(isoDay).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/** "6:00 PM" in the course time zone. */
export function formatClock(value) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE.timeZone });
}

/** "Sunday, Nov 15" */
export const longDay = (isoDay) => formatDay(isoDay, { weekday: "long", month: "short", day: "numeric" });

/** "Nov 15" */
export const shortDay = (isoDay) => formatDay(isoDay, { month: "short", day: "numeric" });

/** "5 days left", "Due tomorrow", "Due today", or null once it's past. */
export function daysLeftLabel(days) {
  if (days < 0) return null;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

// ─── Viewer ─────────────────────────────────────────────────────

/** The signed-in viewer ({ netID, role, groupNumber }), or null when signed out. */
export async function getViewer() {
  try {
    const { netID, role } = await getSessionUser();
    if (!netID || !role || role === "error") return null;
    const { data } = await getSupabaseServer().from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
    return { netID, role, groupNumber: data?.group_number ?? null };
  } catch {
    return null;
  }
}

// ─── Sprints ────────────────────────────────────────────────────

/** Sprints the viewer may see, oldest first. Students and the public don't see a sprint before it starts. */
export async function loadSprints(viewer, now = new Date()) {
  try {
    const { data } = await getSupabaseServer()
      .from(table("sprints"))
      .select("id, number, goal, start_date, end_date")
      .order("start_date", { ascending: true });
    const today = courseTodayISO(now);
    return (data || []).filter((s) => s.start_date && s.end_date && isSprintVisibleToRole(s, viewer?.role, today));
  } catch {
    return [];
  }
}

/** NetID's completed sprint IDs (marked by their PM). */
export async function loadCompletedSprintIds(netID) {
  if (!netID) return new Set();
  try {
    const { data } = await getSupabaseServer().from(table("sprintCompletions")).select("sprint_id").eq("student_net_id", netID);
    return new Set((data || []).map((r) => r.sprint_id));
  } catch {
    return new Set();
  }
}

// ─── MPs ────────────────────────────────────────────────────────

/** Released MPs, by due date. Empty until scripts/migrate-mps.sql has been run. */
export async function loadMps(now = new Date()) {
  try {
    const { data, error } = await getSupabaseServer()
      .from(table("mps"))
      .select("id, name, release_at, due_at, prairielearn_url")
      .order("due_at", { ascending: true });
    if (error) return [];
    return (data || []).filter((mp) => !mp.release_at || new Date(mp.release_at) <= now);
  } catch {
    return [];
  }
}

// ─── Events ─────────────────────────────────────────────────────

/** Events everyone may see listed: open to all, or to every student. */
export function isClassWideEvent(event) {
  const type = event.audience_type ?? "all";
  return type === "all" || (type === "roles" && (event.audience_values || []).map(String).includes("STUDENT"));
}

/**
 * Events the viewer may see that end on or after `since`, soonest first.
 * Signed out: class-wide events only. Signed in: everything whose audience
 * includes them, plus events they created or host. Events that aren't
 * class-wide are flagged `personal` (e.g. their group's meeting).
 */
export async function loadEvents(viewer, { since = new Date(), limit = 300 } = {}) {
  try {
    const columns = "id, title, location, presenter, start_time, end_time, audience_type, audience_values, created_by, hosts";
    const query = (cols) => getSupabaseServer().from(table("events")).select(cols)
      .gte("end_time", since.toISOString()).order("start_time", { ascending: true }).limit(limit);
    let { data, error } = await query(`${columns}, category, series_id`);
    // Before the categories migration, categories are worked out from the audience.
    if (error) ({ data } = await query(columns));
    return (data || [])
      .filter((e) => (viewer
        ? audienceMatches(e, viewer) || e.created_by === viewer.netID || (e.hosts || []).map(String).includes(viewer.netID)
        : isClassWideEvent(e)))
      .map((e) => ({ ...e, personal: !isClassWideEvent(e), categoryLabel: eventCategoryLabel(e) }));
  } catch {
    return [];
  }
}

/** Event → "Friday, Nov 13, 5:00 to 6:00 PM, Siebel CS 2406" style parts. */
export function describeEvent(e) {
  const day = courseDayOf(e.start_time);
  const start = formatClock(e.start_time);
  const end = e.end_time ? formatClock(e.end_time) : null;
  const time = end ? `${start.replace(/ (AM|PM)$/, end.endsWith(start.slice(-2)) ? "" : " $1")} to ${end}` : start;
  return { day, time, place: e.location || null, presenter: e.presenter || null };
}
