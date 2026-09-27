import { getUserGroup } from "./groupSprintChecks";
import { isPmViewRole } from "./roles";

export const CHECK_MANAGE_ROLES = ["course_lead", "head_pm", "lead_web_dev", "web_dev"];

/**
 * Which group a PM/manager may open or close the check for - a PM (or a web dev
 * assigned to a group) is always their own group; a manager names one. Shared
 * by open/ and close/.
 */
export async function resolveActorGroup(userRole, netID, bodyGroupNumber) {
  if (isPmViewRole(userRole)) {
    const groupNumber = await getUserGroup(netID);
    if (groupNumber != null) return { groupNumber };
    return { error: "You are not assigned to a group yet." };
  }
  if (CHECK_MANAGE_ROLES.includes(userRole)) {
    const g = Number(bodyGroupNumber);
    if (bodyGroupNumber == null || bodyGroupNumber === "" || !Number.isInteger(g) || g < 0) return { error: "Please choose a group." };
    return { groupNumber: g };
  }
  return { error: "You do not have permission to do that.", status: 403 };
}
