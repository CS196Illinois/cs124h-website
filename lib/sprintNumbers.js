import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";

/** True when another sprint already uses `number`. */
export async function sprintNumberTaken(number, { exceptId = null } = {}) {
  const { data, error } = await supabaseServer.from(table("sprints")).select("id, number");
  if (error) throw error;
  return (data ?? []).some((sprint) => Number(sprint.number) === number && String(sprint.id) !== String(exceptId));
}

export const sprintNumberTakenMessage = (number) => `Sprint ${number} already exists. Choose a different number.`;
