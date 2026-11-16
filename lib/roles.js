/**
 * Single source of truth for all role definitions.
 * Safe to import on both client and server.
 */

export const ALL_ROLES = [
  { id: "LEAD",     label: "Course Lead",  badgeClass: "badgeLEAD",    order: 0 },
  { id: "HEAD",     label: "Head PM",      badgeClass: "badgeHEAD",    order: 1 },
  { id: "LEAD_WEB", label: "Lead Web Dev", badgeClass: "badgeLEADWEB", order: 2 },
  { id: "PM",       label: "PM",           badgeClass: "badgePM",      order: 3 },
  { id: "STUDENT",  label: "Student",      badgeClass: "badgeSTUDENT", order: 4 },
];

/** Signed-in (session) role for each DB role id. Anything else signs in as "error". */
export const SESSION_ROLE_BY_DB = { LEAD: "course_lead", LEAD_WEB: "lead_web_dev", HEAD: "head_pm", PM: "pm", STUDENT: "student" };

/** DB role id for each session role. */
export const DB_ROLE_BY_SESSION = Object.fromEntries(Object.entries(SESSION_ROLE_BY_DB).map(([db, session]) => [session, db]));

/** Session roles of course staff: they can create events and see the staff tools on the Schedule. */
export const STAFF_ROLES = ["course_lead", "lead_web_dev", "head_pm", "pm"];

/** Look up a role by DB id string. */
export const ROLES_BY_ID = Object.fromEntries(ALL_ROLES.map((r) => [r.id, r]));

/** Get a human-readable label for a DB role id, falling back to the raw id. */
export function roleLabel(id) {
  return ROLES_BY_ID[id]?.label ?? id;
}

/** Sort order for a DB role id; unknown roles sort last. */
export function roleOrder(id) {
  return ROLES_BY_ID[id]?.order ?? 99;
}

/** Every non-student role - i.e. course staff. */
export const STAFF_ROLE_IDS = ALL_ROLES.map((r) => r.id).filter((id) => id !== "STUDENT");

/**
 * Which DB role ids each URL-path role can manage.
 * Mirrors MANAGEABLE_ROLES in app/api/users/route.js - keep in sync.
 */
export const MANAGEABLE_BY = {
  course_lead:  ["LEAD", "LEAD_WEB", "HEAD", "PM", "STUDENT"],
  lead_web_dev: [],
  head_pm:      ["PM", "STUDENT"],
  pm:           ["STUDENT"],
};

/**
 * Aliases used when normalizing role strings from CSV imports.
 * Keys are lowercase; values are canonical DB role ids.
 */
export const ROLE_ALIASES = {
  lead: "LEAD", "course lead": "LEAD", course_lead: "LEAD",
  "lead web dev": "LEAD_WEB", lead_web_dev: "LEAD_WEB", "lead web": "LEAD_WEB", leadweb: "LEAD_WEB",
  head: "HEAD", "head pm": "HEAD", head_pm: "HEAD",
  pm: "PM", "project manager": "PM",
  student: "STUDENT",
};

/** DB role ids with standing Editor access to the shared attendance sheet. */
export const SHEET_ACCESS_ROLES = new Set(["LEAD", "HEAD", "LEAD_WEB"]);

/** The same roles as session roles, for gating the "Open Attendance Sheet" button and route. */
export const SHEET_ACCESS_SESSION_ROLES = new Set([...SHEET_ACCESS_ROLES].map((id) => SESSION_ROLE_BY_DB[id]));
