import { courseTodayISO } from "./dateFormat";
import {
  loadSprints, loadMps, loadEvents, courseDayOf, daysBetween, longDay, shortDay, formatClock, formatDay,
  daysLeftLabel, describeEvent, endOfCourseDay,
} from "./courseData";

/**
 * Everything the home page shows, for this viewer (null = signed out):
 *  - sprint: the sprint running today, or null (with `lastSprint` for context)
 *  - mp: the open MP due soonest, or null
 *  - announcements: upcoming events and deadlines, soonest first
 */
export async function getHomeData(viewer, { now = new Date(), limit = 6 } = {}) {
  const today = courseTodayISO(now);
  const [sprints, mps, events] = await Promise.all([loadSprints(viewer, now), loadMps(now), loadEvents(viewer, { since: now, limit: 60 })]);

  const visible = sprints.filter((s) => s.start_date <= today);
  const running = visible.find((s) => s.end_date >= today) || null;
  const last = visible.filter((s) => s.end_date < today).at(-1) || null;
  const openMps = mps.filter((m) => new Date(m.due_at) >= now);

  const sprint = running && {
    number: running.number,
    goal: running.goal,
    range: `${shortDay(running.start_date)} to ${shortDay(running.end_date)}`,
    due: `Due ${longDay(running.end_date)}`,
    left: daysLeftLabel(daysBetween(today, running.end_date)),
  };

  const nextMp = openMps[0];
  const mp = nextMp && {
    name: nextMp.name,
    due: `Due ${longDay(courseDayOf(nextMp.due_at))} at ${formatClock(nextMp.due_at)}`,
    left: daysLeftLabel(daysBetween(today, courseDayOf(nextMp.due_at))),
    url: nextMp.prairielearn_url,
  };

  const tile = (day) => ({ month: formatDay(day, { month: "short" }), day: formatDay(day, { day: "numeric" }) });
  const items = [];
  for (const s of visible.filter((s) => s.end_date >= today)) {
    items.push({ id: `sprint-${s.id}`, kind: "deadline", at: endOfCourseDay(s.end_date), ...tile(s.end_date), title: `Sprint ${s.number} ends`, detail: longDay(s.end_date) });
  }
  for (const m of openMps) {
    const day = courseDayOf(m.due_at);
    items.push({ id: `mp-${m.id}`, kind: "deadline", at: Date.parse(m.due_at), ...tile(day), title: `MP ${m.name} due`, detail: `${longDay(day)} at ${formatClock(m.due_at)}` });
  }
  for (const e of events) {
    const { day, time, place, presenter } = describeEvent(e);
    items.push({
      id: `event-${e.id}`,
      kind: "event",
      category: e.categoryLabel,
      at: Date.parse(e.start_time),
      ...tile(day),
      title: e.title,
      detail: [`${longDay(day)}, ${time}`, place, presenter && `with ${presenter}`].filter(Boolean).join(", "),
    });
  }
  items.sort((a, b) => a.at - b.at);

  return {
    sprint,
    lastSprint: !running && last ? { number: last.number, ended: longDay(last.end_date) } : null,
    mp,
    announcements: items.slice(0, limit),
  };
}
