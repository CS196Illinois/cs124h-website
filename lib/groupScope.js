import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { isSandboxRole, getSandboxMode, getEffectiveRow, mergeSandboxRows } from "./sandbox";

/** Group roster for PM work, including a developer's private sandbox overlay. */
export async function groupStudentIds(netID, role) {
  const { data: realMe, error } = await supabaseServer.from(table("users")).select("*").eq("net_id", netID).maybeSingle();
  if (error) throw new Error("Could not load group assignment");
  const sandboxed = isSandboxRole(role) && (await getSandboxMode(netID)) !== "off";
  const me = sandboxed ? await getEffectiveRow(netID, "users", netID, realMe) : realMe;
  if (me?.group_number == null) return [];
  const matches = (person) => person.role === "STUDENT" && person.group_number === me.group_number;
  const { data, error: rosterError } = await supabaseServer.from(table("users")).select("net_id, role, group_number").eq("role", "STUDENT").eq("group_number", me.group_number);
  if (rosterError) throw new Error("Could not load group roster");
  const rows = sandboxed ? await mergeSandboxRows(netID, "users", data, matches) : data;
  return rows.filter(matches).map((person) => person.net_id);
}
