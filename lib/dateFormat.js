/**
 * Date/time formatting helpers. Everything user-facing renders in the
 * viewer's own timezone. The one exception is a due date - a calendar day
 * with no time, stored at UTC midnight - which is formatted in UTC so it
 * reads as the same day for everyone.
 */

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A due date (calendar day, stored as a UTC-midnight timestamp). */
export function formatDueDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null;
}

/** A timestamp as a date in the viewer's local timezone. */
export function formatLocalDate(value, opts = { year: "numeric", month: "short", day: "numeric" }) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, opts) : null;
}

/** A timestamp as a date + time in the viewer's local timezone. */
export function formatLocalDateTime(value, opts = { dateStyle: "medium", timeStyle: "short" }) {
  const d = toDate(value);
  return d ? d.toLocaleString(undefined, opts) : null;
}

/** Today as "YYYY-MM-DD" in the viewer's local timezone. */
export function localTodayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Today in the course's timezone. Course calendar dates are Chicago dates. */
export function courseTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A `datetime-local` input value ("2026-09-10T15:30", local) → a UTC ISO string. */
export function datetimeLocalToISO(value) {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

/** A Date → a `datetime-local` input value ("2026-09-10T15:30") in local time. */
export function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** New-event defaults: start at the most recent half hour, end 1.5 hours later. */
export function defaultEventTimes(now = new Date()) {
  const start = new Date(now);
  start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
  const end = new Date(start.getTime() + 90 * 60_000);
  return { start_time: toDatetimeLocal(start), end_time: toDatetimeLocal(end) };
}
