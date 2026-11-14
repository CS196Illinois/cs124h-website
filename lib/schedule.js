import { courseTodayISO } from "./dateFormat";
import {
  loadSprints, loadMps, loadEvents, courseDayOf, addDays, daysBetween, longDay, shortDay, formatDay, formatClock,
  describeEvent, endOfCourseDay,
} from "./courseData";

/** Monday on or before a course day. */
function weekStart(isoDay) {
  const weekday = new Date(`${isoDay}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(isoDay, -((weekday + 6) % 7));
}

/**
 * Everything the schedule page needs, for this viewer (null = signed out).
 * Dates are course days (YYYY-MM-DD) so the client never has to think about
 * time zones.
 */
export async function getScheduleData(viewer, { now = new Date() } = {}) {
  const today = courseTodayISO(now);
  const [sprints, mps] = await Promise.all([loadSprints(viewer, now), loadMps(now)]);

  // The semester starts with the first sprint; without sprints, show from two weeks back.
  const firstDay = sprints[0]?.start_date ?? addDays(today, -14);
  const events = await loadEvents(viewer, { since: new Date(`${firstDay}T00:00:00Z`) });

  const lastDay = [
    addDays(today, 21),
    ...sprints.map((s) => s.end_date),
    ...mps.map((m) => courseDayOf(m.due_at)),
    ...events.map((e) => courseDayOf(e.start_time)),
  ].sort().at(-1);
  const start = weekStart(firstDay);
  const end = addDays(weekStart(lastDay), 6);

  const timeline = {
    start,
    days: daysBetween(start, end) + 1,
    today,
    sprints: sprints.map((s) => ({
      id: s.id,
      label: `Sprint ${s.number}`,
      start: s.start_date,
      end: s.end_date,
      href: `/assignments#sprint-${s.number}`,
      detail: `${shortDay(s.start_date)} to ${shortDay(s.end_date)}${s.goal ? `. ${s.goal}` : ""}`,
    })),
    mps: mps.map((m) => {
      const due = courseDayOf(m.due_at);
      return {
        id: m.id,
        label: `MP ${m.name}`,
        start: m.release_at ? courseDayOf(m.release_at) : null,
        due,
        href: m.prairielearn_url || "/assignments#mps",
        external: Boolean(m.prairielearn_url),
        detail: `Due ${longDay(due)} at ${formatClock(m.due_at)}`,
      };
    }),
    events: events.map((e) => {
      const { day, time, place, presenter } = describeEvent(e);
      return {
        id: e.id,
        day,
        title: e.title,
        category: e.categoryLabel,
        // The creator or a course lead can remove it from the schedule.
        canManage: Boolean(viewer && (e.created_by === viewer.netID || viewer.role === "course_lead")),
        inSeries: Boolean(e.series_id),
        detail: [`${longDay(day)}, ${time}`, place, presenter && `with ${presenter}`].filter(Boolean).join(", "),
      };
    }),
  };

  // Week-by-week list: events plus sprint and MP deadlines.
  const items = [
    ...sprints.map((s) => ({
      id: `sprint-${s.id}`, kind: "deadline", day: s.end_date, at: endOfCourseDay(s.end_date),
      title: `Sprint ${s.number} ends`, detail: longDay(s.end_date),
    })),
    ...mps.map((m) => {
      const day = courseDayOf(m.due_at);
      return { id: `mp-${m.id}`, kind: "deadline", day, at: Date.parse(m.due_at), title: `MP ${m.name} due`, detail: `${longDay(day)} at ${formatClock(m.due_at)}` };
    }),
    ...timeline.events.map((e, i) => ({
      id: `event-${e.id}`, kind: "event", day: e.day, at: Date.parse(events[i].start_time),
      endsAt: Date.parse(events[i].end_time || events[i].start_time), title: e.title, detail: e.detail, category: e.category,
    })),
  ].sort((a, b) => a.at - b.at);

  const thisWeek = weekStart(today);
  const weeks = new Map();
  for (const item of items) {
    const ws = weekStart(item.day);
    if (!weeks.has(ws)) weeks.set(ws, []);
    weeks.get(ws).push({
      ...item,
      month: formatDay(item.day, { month: "short" }),
      date: formatDay(item.day, { day: "numeric" }),
      // An event that's still running isn't past yet.
      past: (item.endsAt ?? item.at) < now.getTime(),
    });
  }
  const label = (ws) => {
    if (ws === thisWeek) return "This week";
    if (ws === addDays(thisWeek, 7)) return "Next week";
    if (ws === addDays(thisWeek, -7)) return "Last week";
    return `Week of ${shortDay(ws)}`;
  };
  const weekList = [...weeks.entries()].map(([ws, list]) => ({
    start: ws,
    label: label(ws),
    range: `${shortDay(ws)} to ${shortDay(addDays(ws, 6))}`,
    items: list,
  }));

  return {
    timeline,
    upcomingWeeks: weekList.filter((w) => w.start >= thisWeek),
    pastWeeks: weekList.filter((w) => w.start < thisWeek).reverse(),
  };
}
