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

/**
 * DB role ids a lead web developer may assign or edit. The web team has been
 * removed, so none: course leads manage the roster.
 */
export const WEB_TEAM_ROLE_IDS = [];

/** Every non-student role - i.e. course staff. */
export const STAFF_ROLE_IDS = ALL_ROLES.map((r) => r.id).filter((id) => id !== "STUDENT");

/** URL-path roles that see the group-scoped PM view. */
export const PM_VIEW_ROLES = ["pm"];
export const isPmViewRole = (role) => PM_VIEW_ROLES.includes(role);

/**
 * Whether a request should be answered as a PM would see it: always for
 * PM-view roles, and for a lead web dev previewing the PM pages (they pass
 * `view=pm`), so "Test As Role → PM" shows their own group as a real PM does
 * instead of the course-wide view.
 */
const PM_PREVIEW_ROLES = ["lead_web_dev"];
export const actsAsPm = (role, view) => isPmViewRole(role) || (view === "pm" && PM_PREVIEW_ROLES.includes(role));

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
