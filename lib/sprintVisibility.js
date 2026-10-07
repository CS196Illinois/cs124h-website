import { courseTodayISO } from "./dateFormat";

/** Course leads can prepare future sprints; everyone else sees them on/after start_date. */
export function isSprintVisibleToRole(sprint, role, today = courseTodayISO()) {
  return role === "course_lead" || !sprint?.start_date || String(sprint.start_date).slice(0, 10) <= today;
}

/** Validate date-only values before they reach Postgres or visibility checks. */
export function validateSprintDates(startDate, endDate) {
  const valid = (value) => {
    if (value == null || value === "") return true;
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  if (!valid(startDate) || !valid(endDate)) return "Start and end dates must use YYYY-MM-DD format.";
  if (startDate && endDate && String(endDate) < String(startDate)) return "End date must be on or after the start date.";
  return null;
}

/** The sprint running today, else the first one listed (the API returns newest first), else null. */
export function getCurrentSprint(sprints, today = courseTodayISO()) {
  if (!sprints?.length) return null;
  return sprints.find((s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date) || sprints[0];
}
