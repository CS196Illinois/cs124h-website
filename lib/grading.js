/**
 * Shared grading helpers for action items and the gradebook. Safe to import
 * on both client and server (no DOM access - CSV downloads live in
 * lib/csvExport.js instead).
 */

/**
 * @returns {null | "pending" | "ready_to_grade" | "graded"}
 * null means the item isn't gradable at all.
 */
export function gradingStatus(item) {
  if (!item?.is_gradable) return null;
  if (!item.is_done) return "pending";
  if (item.grade == null) return "ready_to_grade";
  return "graded";
}

/** Human-readable "92/100" (or just "92" if no max_score is set). */
export function formatGrade(item) {
  if (item?.grade == null) return null;
  return item.max_score != null ? `${item.grade}/${item.max_score}` : `${item.grade}`;
}

/** A single item's score as a percentage, or null if it isn't graded yet. */
export function itemPct(item) {
  if (item?.grade == null || !item.max_score) return null;
  return (item.grade / item.max_score) * 100;
}

/** Average percentage across a list of items, ignoring ungraded ones. Null if none are graded. */
export function averagePct(items) {
  const pcts = items.map(itemPct).filter((p) => p != null);
  if (!pcts.length) return null;
  return pcts.reduce((sum, p) => sum + p, 0) / pcts.length;
}

/**
 * "Group average" = the mean of each student's own average, so every
 * student counts equally regardless of how many assignments they have.
 * Students with nothing graded yet are excluded rather than counted as 0.
 */
export function groupAveragePct(students, items) {
  const studentAverages = students
    .map((s) => averagePct(items.filter((i) => i.net_id === s.net_id)))
    .filter((a) => a != null);
  if (!studentAverages.length) return null;
  return studentAverages.reduce((sum, a) => sum + a, 0) / studentAverages.length;
}

/**
 * Stable identity for "one assignment". Bulk assignments (assigned to more
 * than one person at once) share a batch_id; a one-off assigned to a single
 * person doesn't, so it's its own assignment.
 */
export function assignmentKey(item) {
  return item.batch_id || `solo:${item.id}`;
}

/**
 * Groups a flat list of gradable action items into "assignments" - one
 * entry per batch_id (or per solo item) - each carrying the shared
 * title/due_date/max_score and every recipient's individual item.
 *
 * This is what actually identifies an assignment, as opposed to grouping by
 * title alone: two different assignments can share a title (e.g. a
 * recurring "Weekly Check-in"), and title-based grouping would silently
 * collapse them into one column and lose all but the most recent.
 */
export function buildAssignments(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.is_gradable) continue;
    const key = assignmentKey(item);
    let assignment = map.get(key);
    if (!assignment) {
      assignment = { key, title: item.title, due_date: item.due_date, max_score: item.max_score, created_at: item.created_at, items: [] };
      map.set(key, assignment);
    }
    assignment.items.push(item);
  }
  return [...map.values()].sort((a, b) => new Date(b.due_date || b.created_at) - new Date(a.due_date || a.created_at));
}

/** Short, disambiguating label for an assignment - "Weekly Check-in — Due Sep 12". */
export function assignmentLabel(assignment) {
  const dateSrc = assignment.due_date || assignment.created_at;
  if (!dateSrc) return assignment.title;
  const dateStr = new Date(dateSrc).toLocaleDateString([], { month: "short", day: "numeric" });
  return `${assignment.title} — ${assignment.due_date ? "Due" : "Assigned"} ${dateStr}`;
}

/**
 * CSV column set for a "pivot" gradebook export: one row per student, one
 * column per assignment, plus an overall average. Shared by the full-course,
 * per-group, and per-assignment-scoped exports - pass `downloadCsv` the
 * students you want rows for alongside these columns.
 */
export function pivotColumns(assignments, { includeGroupColumn = false } = {}) {
  return [
    { key: "name", label: "Name", value: (s) => s.name || "" },
    { key: "net_id", label: "NetID" },
    ...(includeGroupColumn ? [{ key: "group_number", label: "Group", value: (s) => s.group_number ?? "" }] : []),
    ...assignments.map((a) => ({
      key: a.key,
      label: assignmentLabel(a),
      value: (s) => a.items.find((i) => i.net_id === s.net_id)?.grade ?? "",
    })),
    {
      key: "average",
      label: "Average %",
      value: (s) => {
        const mine = assignments.flatMap((a) => a.items.filter((i) => i.net_id === s.net_id));
        const avg = averagePct(mine);
        return avg != null ? avg.toFixed(1) : "";
      },
    },
  ];
}
