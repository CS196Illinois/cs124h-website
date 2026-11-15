/**
 * Date/time fields in forms are in the course's time zone (Chicago), whatever
 * the viewer's own clock says. Safe on server and client.
 */
const TIME_ZONE = "America/Chicago";

/** Minutes the course time zone is ahead of UTC at `ms` (e.g. -360 for CST). */
function offsetMinutes(ms) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** "2026-11-18" + "17:30" (course time) → ISO timestamp. */
export function courseTimeToISO(day, time) {
  const guess = Date.parse(`${day}T${time}:00Z`);
  return new Date(guess - offsetMinutes(guess) * 60_000).toISOString();
}

/** ISO timestamp → { day: "2026-11-18", time: "17:30" } in course time. */
export function isoToCourseParts(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
