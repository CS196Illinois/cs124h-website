/**
 * Shared grading helpers for action items. Safe to import on both client and server.
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
