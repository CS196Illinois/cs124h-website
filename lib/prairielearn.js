/**
 * Server-only PrairieLearn access. The token is a staff member's personal
 * API token (PRAIRIELEARN_API_TOKEN); it must never reach the browser.
 * The course instance may be set as a bare number or a pasted course URL,
 * under PRAIRIELEARN_COURSE_INSTANCE_ID or PRAIRIELEARN_COURSE_INSTANCE.
 */
const TIMEOUT_MS = 8000;

export function prairieLearnConfig() {
  const token = process.env.PRAIRIELEARN_API_TOKEN?.trim();
  const raw = (process.env.PRAIRIELEARN_COURSE_INSTANCE_ID || process.env.PRAIRIELEARN_COURSE_INSTANCE || "").trim();
  const courseInstance = raw.match(/course_instance\/(\d+)/)?.[1] || (/^\d+$/.test(raw) ? raw : null);
  const host = (process.env.PRAIRIELEARN_HOST || "https://us.prairielearn.com").replace(/\/$/, "");
  return token && courseInstance ? { token, courseInstance, host } : null;
}

/** Link to an assessment in the course instance, or null when PrairieLearn isn't configured. */
export function assessmentUrl(assessmentId) {
  const config = prairieLearnConfig();
  return config ? `${config.host}/pl/course_instance/${config.courseInstance}/assessment/${assessmentId}` : null;
}

/**
 * The course's MPs on PrairieLearn (its "Minis" assessment set), as
 * { id, title, label, url }. Empty when PrairieLearn isn't configured or
 * can't be reached; never throws.
 */
export async function listPrairieLearnMps() {
  const config = prairieLearnConfig();
  if (!config) return [];
  try {
    const res = await fetch(`${config.host}/pl/api/v1/course_instances/${config.courseInstance}/assessments`, {
      headers: { "Private-Token": config.token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const assessments = await res.json();
    return (Array.isArray(assessments) ? assessments : [])
      .filter((a) => a.assessment_set_name === "Minis")
      .sort((a, b) => Number(a.assessment_number) - Number(b.assessment_number))
      .map((a) => ({ id: String(a.assessment_id), title: a.title, label: a.assessment_label, url: assessmentUrl(a.assessment_id) }));
  } catch {
    return [];
  }
}
