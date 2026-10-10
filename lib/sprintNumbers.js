import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { isSandboxRole, getSandboxMode, mergeSandboxRows } from "./sandbox";

/** True when another sprint, as this user sees them, already uses `number`. */
export async function sprintNumberTaken(number, { netID, role, exceptId = null }) {
  const { data, error } = await supabaseServer.from(table("sprints")).select("id, number");
  if (error) throw error;
  let rows = data ?? [];
  if (isSandboxRole(role) && (await getSandboxMode(netID)) !== "off") {
    rows = await mergeSandboxRows(netID, "sprints", rows);
  }
  return rows.some((sprint) => Number(sprint.number) === number && String(sprint.id) !== String(exceptId));
}

export const sprintNumberTakenMessage = (number) => `Sprint ${number} already exists. Choose a different number.`;
