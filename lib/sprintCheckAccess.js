import { getUserGroup } from "./groupSprintChecks";
import { isPmViewRole } from "./roles";
import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";

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

// Course-wide roles that oversee every group's understanding checks.
const CHECK_ADMIN_ROLES = ["course_lead", "head_pm", "lead_web_dev"];

/**
 * Which of these students' understanding-check submissions the caller may
 * view, grade, or manage. Managers: all of them. A PM (or a web dev acting
 * as one): only students in their own group - regardless of who opened the
 * check window, since that person is recorded as the submission's assigner.
 */
export async function manageableCheckStudents(userRole, netID, studentNetIDs) {
  const ids = [...new Set(studentNetIDs)];
  if (CHECK_ADMIN_ROLES.includes(userRole)) return new Set(ids);
  if (!isPmViewRole(userRole) || ids.length === 0) return new Set();
  const myGroup = await getUserGroup(netID);
  if (myGroup == null) return new Set();
  const { data, error } = await supabaseServer.from(table("users")).select("net_id").in("net_id", ids).eq("group_number", myGroup);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.net_id));
}

export async function canManageCheckSubmission(userRole, netID, studentNetID) {
  return (await manageableCheckStudents(userRole, netID, [studentNetID])).has(studentNetID);
}
