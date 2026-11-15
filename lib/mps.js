/** Course leads and head PMs maintain MPs, as they do sprints. */
export const MP_MANAGE_ROLES = ["course_lead", "head_pm"];

/** Shared validation for MP create/edit. Returns { values } or { error }. */
const NAME_MAX = 80;

const validTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function validateMp(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Please check the MP details and try again." };
  const values = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "Give the MP a name." };
    if (body.name.trim().length > NAME_MAX) return { error: `MP names must be ${NAME_MAX} characters or fewer.` };
    values.name = body.name.trim();
  }
  if (!partial || body.due_at !== undefined) {
    if (!validTime(body.due_at)) return { error: "Choose the due date and time." };
    values.due_at = new Date(body.due_at).toISOString();
  }
  if (body.release_at !== undefined) {
    if (body.release_at !== null && body.release_at !== "" && !validTime(body.release_at)) return { error: "Choose a valid opening date and time." };
    values.release_at = body.release_at ? new Date(body.release_at).toISOString() : null;
  }
  if (body.prairielearn_url !== undefined) {
    if (body.prairielearn_url === null || body.prairielearn_url === "") values.prairielearn_url = null;
    else {
      let url;
      try { url = new URL(body.prairielearn_url); } catch { return { error: "The PrairieLearn link isn't a valid web address." }; }
      if (url.protocol !== "https:") return { error: "The PrairieLearn link must start with https://." };
      values.prairielearn_url = url.toString();
    }
  }
  const release = values.release_at ?? body.release_at;
  const due = values.due_at ?? body.due_at;
  if (release && due && Date.parse(release) >= Date.parse(due)) return { error: "The MP must open before it's due." };
  return { values };
}
