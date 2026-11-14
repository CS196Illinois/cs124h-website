import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";

/** NetIDs of the students in `netID`'s group (empty when they have no group). */
export async function groupStudentIds(netID) {
  const { data: me, error } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
  if (error) throw new Error("Could not load group assignment");
  if (me?.group_number == null) return [];
  const { data, error: rosterError } = await supabaseServer.from(table("users")).select("net_id").eq("role", "STUDENT").eq("group_number", me.group_number);
  if (rosterError) throw new Error("Could not load group roster");
  return (data ?? []).map((person) => person.net_id);
}
