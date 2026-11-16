import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { courseTodayISO } from "./dateFormat";
import { termFor } from "./term";

/** The semester a sprint belongs to, by its start date (undated sprints count as this semester). */
const sprintTerm = (startDate) => termFor(startDate ? String(startDate).slice(0, 10) : courseTodayISO()).name;

/**
 * True when another sprint in the same semester already uses `number`.
 * Numbers restart each semester, so last term's Sprint 1 doesn't block this
 * term's.
 */
export async function sprintNumberTaken(number, { exceptId = null, startDate = null } = {}) {
  const { data, error } = await supabaseServer.from(table("sprints")).select("id, number, start_date");
  if (error) throw error;
  const term = sprintTerm(startDate);
  return (data ?? []).some((sprint) => Number(sprint.number) === number && String(sprint.id) !== String(exceptId) && sprintTerm(sprint.start_date) === term);
}

export const sprintNumberTakenMessage = (number) => `Sprint ${number} already exists this semester. Choose a different number.`;
