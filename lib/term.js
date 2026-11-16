/**
 * The current semester, worked out from the date so nothing has to be
 * updated by hand each term.
 *
 * Illinois instruction begins on:
 *  - Fall: the first Monday on or after August 20 (2021-08-23, 2022-08-22,
 *    2023-08-21, 2024-08-26, 2025-08-25, 2026-08-24).
 *  - Spring: the Tuesday after Martin Luther King Jr. Day, the third Monday
 *    of January (2024-01-16, 2025-01-21, 2026-01-20, 2027-01-19).
 *
 * The site belongs to Spring from January through June and to Fall from July
 * through December, so summer pages already point at the coming fall.
 *
 * Safe to import on both client and server.
 */

import { courseTodayISO } from "./dateFormat";

const DAY_MS = 86_400_000;

const isoDay = (date) => date.toISOString().slice(0, 10);
const utc = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day));

/** First day of fall classes: the first Monday on or after Aug 20. */
function fallStart(year) {
  const aug20 = utc(year, 7, 20);
  const offset = (8 - aug20.getUTCDay()) % 7; // days until Monday (0 if Aug 20 is a Monday)
  return isoDay(new Date(aug20.getTime() + offset * DAY_MS));
}

/** First day of spring classes: the day after the third Monday of January. */
function springStart(year) {
  const jan1 = utc(year, 0, 1);
  const firstMonday = 1 + ((8 - jan1.getUTCDay()) % 7);
  return isoDay(utc(year, 0, firstMonday + 14 + 1));
}

/**
 * The term a course day (YYYY-MM-DD) belongs to:
 * { name: "Fall 2026", season: "fall", year: 2026, classesStart: "2026-08-24",
 *   from: "2026-07-01", to: "2026-12-31" }.
 */
export function termFor(day) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (month <= 6) {
    return { name: `Spring ${year}`, season: "spring", year, classesStart: springStart(year), from: `${year}-01-01`, to: `${year}-06-30` };
  }
  return { name: `Fall ${year}`, season: "fall", year, classesStart: fallStart(year), from: `${year}-07-01`, to: `${year}-12-31` };
}

/** The term today (course time) belongs to. */
export const currentTerm = (now = new Date()) => termFor(courseTodayISO(now));

/** True when a course day falls before the current term (left over from an earlier semester). */
export const beforeTerm = (day, term) => Boolean(day) && String(day).slice(0, 10) < term.from;

/**
 * Sort key for a semester label like "Fall 2026" or "Spring 2025": newer
 * terms sort higher. Unknown labels sort last.
 */
export function semesterSortKey(label) {
  const match = String(label ?? "").match(/(spring|summer|fall)\s+(\d{4})/i);
  if (!match) return -Infinity;
  return Number(match[2]) * 10 + { spring: 1, summer: 2, fall: 3 }[match[1].toLowerCase()];
}
