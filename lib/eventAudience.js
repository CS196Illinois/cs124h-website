// Client-safe audience rules shared by the picker and server access checks.
import { STAFF_ROLE_IDS } from "./roles";

export const EVENT_AUDIENCE_TYPES = ["all", "people", "roles", "groups"];

/** "All staff" is stored as a roles audience listing every non-student role. */
export const STAFF_AUDIENCE = { audience_type: "roles", audience_values: STAFF_ROLE_IDS };

export function isStaffAudience(event) {
  const values = Array.isArray(event?.audience_values) ? event.audience_values.map(String) : [];
  return event?.audience_type === "roles" && values.length === STAFF_ROLE_IDS.length && STAFF_ROLE_IDS.every((id) => values.includes(id));
}

export function audienceMatches(event, { netID, role, groupNumber }) {
  const type = event?.audience_type || "all";
  const values = Array.isArray(event?.audience_values) ? event.audience_values.map(String) : [];
  if (type === "all") return true;
  if (type === "people") return values.includes(String(netID));
  if (type === "roles") {
    const dbRole = { course_lead: "LEAD", lead_web_dev: "LEAD_WEB", head_pm: "HEAD", pm: "PM", web_dev: "WEB", student: "STUDENT" }[role] || String(role).toUpperCase();
    return values.includes(dbRole);
  }
  if (type === "groups") return groupNumber != null && values.includes(String(groupNumber));
  return false;
}
