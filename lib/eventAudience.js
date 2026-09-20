// Client-safe audience rules shared by the picker and server access checks.
export const EVENT_AUDIENCE_TYPES = ["all", "people", "roles", "groups"];

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
