import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { isPmViewRole } from "../../../lib/roles";
import { groupStudentIds } from "../../../lib/groupScope";
import { manageableCheckStudents } from "../../../lib/sprintCheckAccess";
import { isSandboxRole, getSandboxMode, mergeSandboxRows } from "../../../lib/sandbox";
import { serverError, signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";

export async function GET(request) {
  const { role: userRole, netID } = await getSessionUser();

  if (!userRole || userRole === "error") {
    return signInRequired();
  }

  const { searchParams } = new URL(request.url);
  // scope=mine: own/assigned items; scope=all: the caller's management scope.
  const scope = searchParams.get("scope") || "mine";

  let visibleRecipients = null;
  // The developer's PM screens use the same group scope as PMs; explicit
  // developer previews retain their existing access and sandbox tools.
  if (userRole === "web_dev" && searchParams.get("group_scope") === "true") {
    visibleRecipients = [netID, ...await groupStudentIds(netID, userRole)];
  }
  if (userRole === "pm" || userRole === "head_pm") {
    let roster = supabaseServer.from(table("users")).select("net_id");
    if (userRole === "pm") {
      const { data: me, error } = await supabaseServer.from(table("users")).select("group_number").eq("net_id", netID).maybeSingle();
      if (error) return serverError();
      if (me?.group_number == null) visibleRecipients = [netID];
      else roster = roster.eq("role", "STUDENT").eq("group_number", me.group_number);
    } else {
      roster = roster.in("role", ["PM", "STUDENT"]);
    }
    if (!visibleRecipients) {
      const { data, error } = await roster;
      if (error) return serverError();
      visibleRecipients = [...new Set([netID, ...data.map((row) => row.net_id)])];
    }
  }

  let query = supabaseServer
    .from(table("actionItems"))
    .select("*")
    .order("created_at", { ascending: false });

  if (visibleRecipients) query = query.in("net_id", visibleRecipients);

  if (userRole === "student") {
    // Always own items only, regardless of scope
    query = query.eq("net_id", netID);
  } else if (scope === "mine") {
    // Items assigned to me OR that I assigned to others
    query = query.or(`net_id.eq.${netID},assigned_by.eq.${netID}`);
  }

  const { data, error } = await query;
  if (error) return serverError();

  let rows = data;
  if (isSandboxRole(userRole) && (await getSandboxMode(netID)) !== "off") {
    const matchesFilter = scope === "mine"
      ? (row) => row.net_id === netID || row.assigned_by === netID
      : () => true;
    rows = await mergeSandboxRows(netID, "actionItems", rows, matchesFilter);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (visibleRecipients) rows = rows.filter((row) => visibleRecipients.includes(row.net_id));
  // PMs (and web devs acting as PMs) only ever see their own group's
  // understanding-check submissions, whatever scope they asked for.
  if (isPmViewRole(userRole)) {
    const checkStudents = rows.filter((row) => row.sprint_id && row.net_id !== netID).map((row) => row.net_id);
    const allowed = await manageableCheckStudents(userRole, netID, checkStudents);
    rows = rows.filter((row) => !row.sprint_id || row.net_id === netID || allowed.has(row.net_id));
  }
  return NextResponse.json(rows);
}
