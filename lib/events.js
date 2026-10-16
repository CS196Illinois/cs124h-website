import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, mergeSandboxRows } from "./sandbox";
import { EVENT_AUDIENCE_TYPES } from "./eventAudience";

// These roles can see the full event list, but editing and deleting remain
// restricted to the person who created each event.
export const EVENT_ADMIN_ROLES = ["lead_web_dev", "course_lead"];

export const canAdminEvents = (role) => EVENT_ADMIN_ROLES.includes(role);

// These roles can run check-in (open/close, code, attendees) for any event,
// e.g. when the creator isn't the one presenting.
export const CHECKIN_OVERRIDE_ROLES = ["course_lead"];

export const eventHosts = (event) => Array.isArray(event?.hosts) ? event.hosts.map(String) : [];

/** Creator, a listed host, or a course lead may run an event's check-in. */
export function canRunCheckIn(event, netID, role) {
  if (!event || !netID) return false;
  return event.created_by === netID || eventHosts(event).includes(netID) || CHECKIN_OVERRIDE_ROLES.includes(role);
}

/** Hosts must be staff on the roster; the creator is implied and dropped. */
export async function validateEventHosts(values, netID, role) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) return { error: "Please choose valid hosts." };
  const cleaned = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].filter((value) => value !== netID);
  if (!cleaned.length) return { values: [] };
  const { data, error } = await supabaseServer.from(table("users")).select("net_id, role");
  if (error) return { error: "The hosts could not be checked. Please try again.", status: 503 };
  const roster = netID && isSandboxRole(role) && (await getSandboxMode(netID)) !== "off"
    ? await mergeSandboxRows(netID, "users", data || [], () => true) : data || [];
  const staff = new Set(roster.filter((person) => person.role && String(person.role).toUpperCase() !== "STUDENT").map((person) => person.net_id));
  if (cleaned.some((value) => !staff.has(value))) return { error: "Hosts must be staff members on the roster." };
  return { values: cleaned };
}

export { EVENT_AUDIENCE_TYPES, audienceMatches } from "./eventAudience";

export function eventHasEnded(event, now = Date.now()) {
  return !!event?.end_time && Number.isFinite(Date.parse(event.end_time)) && Date.parse(event.end_time) <= now;
}

export async function validateEventAudience(type, values, netID, role) {
  if (!EVENT_AUDIENCE_TYPES.includes(type) || !Array.isArray(values) || values.some((value) => !["string", "number"].includes(typeof value))) return { error: "Please choose a valid event audience." };
  const cleaned = [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
  if (type !== "all" && !cleaned.length) return { error: "Select at least one audience member." };
  if (type === "roles") {
    if (cleaned.some((value) => !["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"].includes(value.toUpperCase()))) return { error: "Choose a valid role." };
    return { values: [...new Set(cleaned.map((value) => value.toUpperCase()))] };
  }
  if (["people", "groups"].includes(type)) {
    const { data, error } = await supabaseServer.from(table("users")).select("net_id, group_number");
    if (error) return { error: "The audience could not be checked. Please try again.", status: 503 };
    const roster = netID && isSandboxRole(role) && (await getSandboxMode(netID)) !== "off"
      ? await mergeSandboxRows(netID, "users", data || [], () => true) : data || [];
    const valid = new Set(roster.map((person) => type === "people" ? person.net_id : person.group_number == null ? null : String(person.group_number)));
    if (cleaned.some((value) => !valid.has(value))) return { error: "One or more audience selections are not in the roster." };
  }
  return { values: type === "all" ? [] : cleaned };
}

async function loadEvent(id, netID, userRole, columns) {
  const withHosts = columns === "*" ? columns : `${columns}, hosts`;
  let { data: real, error } = await supabaseServer
    .from(table("events")).select(withHosts).eq("id", id).maybeSingle();
  // Before the hosts migration runs, fall back to creator-only behaviour.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ data: real } = await supabaseServer.from(table("events")).select(columns).eq("id", id).maybeSingle());
  }
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    return getEffectiveRow(netID, "events", id, real);
  }
  return real;
}

/**
 * Returns the event row when `netID` created it; otherwise null (callers turn
 * that into a 403).
 * Sandbox-aware so a web dev previewing their own overlay still works.
 */
export async function getManagedEvent(id, netID, userRole, columns = "id, title, created_by, check_in_open") {
  const event = await loadEvent(id, netID, userRole, columns);
  return event?.created_by === netID ? event : null;
}

/** Like getManagedEvent, but also admits hosts and course leads (see canRunCheckIn). */
export async function getCheckInEvent(id, netID, userRole, columns = "id, title, created_by, check_in_open") {
  const event = await loadEvent(id, netID, userRole, columns);
  return canRunCheckIn(event, netID, userRole) ? event : null;
}
