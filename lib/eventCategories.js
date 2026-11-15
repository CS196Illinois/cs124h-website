/**
 * Event categories. Stored as the key in events.category; shown everywhere
 * an event is listed (home, schedule, dashboards) in place of a generic
 * "Event" label.
 */
export const EVENT_CATEGORIES = [
  { id: "workshop", label: "Workshop" },
  { id: "group_meeting", label: "Group meeting" },
  { id: "info_session", label: "Info session" },
  { id: "presentation", label: "Presentations" },
  { id: "social", label: "Social" },
  { id: "staff_meeting", label: "Staff meeting" },
  { id: "other", label: "Other" },
];

const LABELS = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c.label]));

export const isEventCategory = (id) => Object.hasOwn(LABELS, id);

import { STAFF_ROLE_IDS as STAFF_ROLES } from "./roles";

/**
 * The event's category id. Events from before categories existed get one
 * from their audience: a group or hand-picked list is a group meeting, a
 * staff-only audience a staff meeting, anything else a workshop.
 */
export function eventCategory(event) {
  if (isEventCategory(event?.category)) return event.category;
  const type = event?.audience_type ?? "all";
  const values = (event?.audience_values || []).map(String);
  if (type === "groups" || type === "people") return "group_meeting";
  if (type === "roles" && values.length && values.every((v) => STAFF_ROLES.includes(v))) return "staff_meeting";
  return "workshop";
}

export const eventCategoryLabel = (event) => LABELS[eventCategory(event)];

/** The category a new event starts with, by who is creating it. */
export function defaultCategoryFor(role) {
  if (role === "pm") return "group_meeting";
  if (["course_lead", "head_pm", "lead_web_dev"].includes(role)) return "workshop";
  return "workshop";
}
