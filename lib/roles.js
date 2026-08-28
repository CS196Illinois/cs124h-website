/**
 * Single source of truth for all role definitions.
 * Safe to import on both client and server.
 */

export const ALL_ROLES = [
  { id: "LEAD",     label: "Course Lead",  badgeClass: "badgeLEAD",    order: 0 },
  { id: "HEAD",     label: "Head PM",      badgeClass: "badgeHEAD",    order: 1 },
  { id: "LEAD_WEB", label: "Lead Web Dev", badgeClass: "badgeLEADWEB", order: 2 },
  { id: "PM",       label: "PM",           badgeClass: "badgePM",      order: 3 },
  { id: "WEB",      label: "Web Dev",      badgeClass: "badgeWEB",     order: 4 },
  { id: "STUDENT",  label: "Student",      badgeClass: "badgeSTUDENT", order: 5 },
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
 * Which DB role ids each URL-path role can manage.
 * Mirrors MANAGEABLE_ROLES in app/api/users/route.js - keep in sync.
 */
export const MANAGEABLE_BY = {
  course_lead:  ["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"],
  lead_web_dev: ["LEAD_WEB", "WEB"],
  web_dev:      ["LEAD", "LEAD_WEB", "HEAD", "PM", "WEB", "STUDENT"],
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
  web: "WEB", "web dev": "WEB", web_dev: "WEB", developer: "WEB",
  student: "STUDENT",
};
