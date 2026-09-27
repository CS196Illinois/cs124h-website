import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { getSandboxMode, isSandboxRole, mergeSandboxRows, sandboxWrite } from "./sandbox";
import { randomUUID } from "crypto";

export async function getUserGroup(netID) {
  const { data, error } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
  if (error) throw error;
  return data?.group_number ?? null;
}

/** One query for any number of sprints or groups; callers enforce viewer scope. */
export async function fetchGroupChecks(sprintIds, groupNumber, netID, role) {
  if (!sprintIds.length || groupNumber === null) return [];
  let query = supabaseServer.from(table("sprintGroupChecks")).select("*").in("sprint_id", sprintIds);
  if (groupNumber !== undefined) query = query.eq("group_number", groupNumber);
  const { data, error } = await query;
  if (error) throw error;
  if (isSandboxRole(role) && (await getSandboxMode(netID)) !== "off") {
    return mergeSandboxRows(netID, "sprintGroupChecks", data ?? [], (row) =>
      sprintIds.includes(row.sprint_id) && (groupNumber === undefined || row.group_number === groupNumber));
  }
  return data ?? [];
}

export function applyGroupQuestions(sprint, additionalQuestions = []) {
  const required = sprint.check_questions ?? [];
  const questions = [...required, ...additionalQuestions.filter((q) => !required.includes(q))];
  return { ...sprint, required_check_questions: required, check_questions: questions.length ? questions : null };
}

export async function groupSprintChecks(sprints, groupNumber, netID, role) {
  const rows = await fetchGroupChecks(sprints.map((s) => s.id), groupNumber, netID, role);
  const bySprint = new Map(rows.map((row) => [row.sprint_id, row.additional_questions]));
  return sprints.map((sprint) => applyGroupQuestions(sprint, bySprint.get(sprint.id)));
}

export async function saveGroupSprintCheck(sprintId, groupNumber, questions, netID, role) {
  const row = { sprint_id: sprintId, group_number: groupNumber, additional_questions: questions };
  if (isSandboxRole(role) && await getSandboxMode(netID) !== "off") {
    const { data, error } = await supabaseServer.from(table("sprintGroupChecks")).select("*")
      .eq("sprint_id", sprintId).eq("group_number", groupNumber).maybeSingle();
    if (error) throw error;
    const rows = await mergeSandboxRows(netID, "sprintGroupChecks", data ? [data] : [],
      (r) => r.sprint_id === sprintId && r.group_number === groupNumber);
    const id = rows[0]?.id ?? randomUUID();
    await sandboxWrite(netID, "sprintGroupChecks", rows.length ? "update" : "insert", id, { id, ...row });
    return;
  }
  const { error } = await supabaseServer.from(table("sprintGroupChecks")).upsert(row, { onConflict: "sprint_id,group_number" });
  if (error) throw error;
}
