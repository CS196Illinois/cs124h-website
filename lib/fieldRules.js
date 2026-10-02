/**
 * Field rules shared by forms and API routes, so a field the database requires
 * (or limits) is required and limited the same way everywhere.
 * Safe to import on both client and server.
 */

/** events.title / presenter / location are varchar(255) in the database. */
export const EVENT_TEXT_MAX = 255;

/** event_checkins.net_id is varchar(50) in the database. */
export const CHECKIN_NETID_MAX = 50;

/** Default action-item max score when a gradable item leaves it blank. */
export const DEFAULT_MAX_SCORE = 100;

const isBlank = (value) => value == null || String(value).trim() === "";

/** Group number: blank → null (unassigned); otherwise a whole number ≥ 0. */
export function parseGroupNumber(value) {
  if (isBlank(value)) return { value: null };
  const group = Number(value);
  if ((typeof value !== "string" && typeof value !== "number") || !Number.isInteger(group) || group < 0) {
    return { error: "Enter a whole group number of zero or greater, or leave it blank to unassign." };
  }
  return { value: group };
}

/** Sprint number: required, a whole number ≥ 0. */
export function parseSprintNumber(value) {
  const number = Number(value);
  if (isBlank(value) || typeof value === "boolean" || !Number.isInteger(number) || number < 0) {
    return { error: "Sprint number must be a non-negative whole number." };
  }
  return { value: number };
}

/** Gradable max score: blank → DEFAULT_MAX_SCORE; otherwise a positive number. */
export function parseMaxScore(value) {
  if (isBlank(value)) return { value: DEFAULT_MAX_SCORE };
  const score = Number(value);
  if (typeof value === "boolean" || !Number.isFinite(score) || score <= 0) {
    return { error: "Maximum score must be a positive number." };
  }
  return { value: score };
}
