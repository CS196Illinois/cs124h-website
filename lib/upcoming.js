import { getSupabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { courseTodayISO } from "./dateFormat";
import { SITE } from "./siteConfig";

/** A calendar date ("2027-01-25") → "Mon, Jan 25". */
export function formatCourseDay(isoDate) {
  if (!isoDate) return null;
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** A timestamp → "Mon, Jan 25 · 6:00 PM" in the course time zone (server renders in UTC otherwise). */
export function formatCourseDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: SITE.timeZone });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE.timeZone });
  return `${day} · ${time}`;
}

/**
 * Public "coming up" items for the home page: sprints in progress plus the
 * next few events open to everyone. Sprints aren't shown before their start
 * date (students can't see them yet either), and audience-restricted events
 * are left out. Never throws: an outage just means an empty list.
 */
export async function getUpcoming({ eventLimit = 3, now = new Date() } = {}) {
  const today = courseTodayISO(now);
  const supabase = getSupabaseServer();
  const items = [];

  try {
    const { data } = await supabase
      .from(table("sprints"))
      .select("id, number, goal, start_date, end_date")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: true });
    for (const sprint of data || []) {
      items.push({
        kind: "sprint",
        id: `sprint-${sprint.id}`,
        tag: `Sprint ${sprint.number}`,
        title: sprint.goal || `Sprint ${sprint.number}`,
        when: `Due ${formatCourseDay(sprint.end_date)}`,
        sortKey: `${sprint.end_date}T23:59`,
      });
    }
  } catch {}

  try {
    const { data } = await supabase
      .from(table("events"))
      .select("id, title, location, start_time, end_time, audience_type")
      .gte("end_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(eventLimit * 3);
    for (const event of (data || []).filter((e) => (e.audience_type ?? "all") === "all").slice(0, eventLimit)) {
      items.push({
        kind: "event",
        id: `event-${event.id}`,
        tag: "Event",
        title: event.title,
        when: [formatCourseDateTime(event.start_time), event.location].filter(Boolean).join(" · "),
        sortKey: event.start_time,
      });
    }
  } catch {}

  return items.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}
