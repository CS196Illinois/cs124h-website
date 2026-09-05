/**
 * Shared helpers for the weekly understanding-check feature. Safe on both
 * client and server.
 */

/** Trims/drops blank questions; caps the list so the form and DB stay sane. */
export function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return null;
  const cleaned = questions.map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 8);
  return cleaned.length ? cleaned : null;
}

/** Grading default matches the app-wide "100 unless a valid positive number is set" convention. */
export function resolveMaxScore(sprint) {
  const n = Number(sprint?.check_max_score);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** Q/A text block - renders wherever action_items.description already does today. */
export function formatCheckAnswers(questions, answers) {
  return questions.map((q, i) => `Q: ${q}\nA: ${(answers[i] ?? "").trim()}`).join("\n\n");
}

export const DEFAULT_CHECK_QUESTIONS = [
  "What design decisions did you make this week, and why?",
  "What alternative approaches did you consider, and why didn't you choose them?",
  "How well did your work this week integrate with the rest of your group's work?",
];
