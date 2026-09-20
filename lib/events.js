import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, mergeSandboxRows } from "./sandbox";
import { EVENT_AUDIENCE_TYPES } from "./eventAudience";

// These roles can see the full event list, but management remains restricted
// to the person who created each event.
export const EVENT_ADMIN_ROLES = ["lead_web_dev"];

export const canAdminEvents = (role) => EVENT_ADMIN_ROLES.includes(role);

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

/**
 * Returns the event row when `netID` created it; otherwise null (callers turn
 * that into a 403).
 * Sandbox-aware so a web dev previewing their own overlay still works.
 */
export async function getManagedEvent(id, netID, userRole, columns = "id, title, created_by, check_in_open") {
  const { data: real } = await supabaseServer
    .from(table("events")).select(columns).eq("id", id).maybeSingle();
  let event = real;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    event = await getEffectiveRow(netID, "events", id, real);
  }
  if (!event) return null;
  return event.created_by === netID ? event : null;
}
