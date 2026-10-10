import { describe, it, expect } from "vitest";
import { formatDueDate, formatLocalDate, formatLocalDateTime, localTodayISO, courseTodayISO, datetimeLocalToISO, toDatetimeLocal, defaultEventTimes } from "../../lib/dateFormat";

describe("dateFormat", () => {
  it("formats a due date (UTC-midnight) as the same calendar day everywhere", () => {
    // The bug this guards against: naive local formatting of a UTC-midnight
    // value shows the day before for anyone west of UTC.
    const naiveInLA = new Date("2026-09-10T00:00:00Z").toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
    expect(naiveInLA).toBe("9/9/2026");

    expect(formatDueDate("2026-09-10T00:00:00Z")).toBe("Sep 10, 2026");
    expect(formatDueDate("2026-09-10")).toBe("Sep 10, 2026");
    expect(formatDueDate("2026-09-10T00:00:00+00:00")).toBe("Sep 10, 2026");
  });

  it("returns null for missing or unparseable values", () => {
    expect(formatDueDate(null)).toBeNull();
    expect(formatDueDate("")).toBeNull();
    expect(formatLocalDate(undefined)).toBeNull();
    expect(formatLocalDateTime("not a date")).toBeNull();
  });

  it("localTodayISO returns a YYYY-MM-DD string", () => {
    expect(localTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("courseTodayISO uses the Chicago course calendar at UTC day boundaries", () => {
    expect(courseTodayISO(new Date("2026-09-12T04:30:00Z"))).toBe("2026-09-11");
    expect(courseTodayISO(new Date("2026-09-12T05:30:00Z"))).toBe("2026-09-12");
  });

  it("datetimeLocalToISO turns a naive local datetime into a UTC ISO string", () => {
    const iso = datetimeLocalToISO("2026-09-10T15:30");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    // Round-trips back to the same wall-clock time in this runtime's zone.
    const back = new Date(iso);
    expect(back.getHours()).toBe(15);
    expect(back.getMinutes()).toBe(30);
    expect(datetimeLocalToISO("")).toBeNull();
  });

  it("toDatetimeLocal formats a Date as a local datetime-local value", () => {
    expect(toDatetimeLocal(new Date(2026, 8, 5, 7, 3))).toBe("2026-09-05T07:03");
  });

  it("defaultEventTimes starts at the most recent half hour and runs 1.5 hours", () => {
    expect(defaultEventTimes(new Date(2026, 9, 10, 14, 17, 45))).toEqual({ start_time: "2026-10-10T14:00", end_time: "2026-10-10T15:30" });
    expect(defaultEventTimes(new Date(2026, 9, 10, 14, 30))).toEqual({ start_time: "2026-10-10T14:30", end_time: "2026-10-10T16:00" });
    expect(defaultEventTimes(new Date(2026, 9, 10, 23, 45))).toEqual({ start_time: "2026-10-10T23:30", end_time: "2026-10-11T01:00" });
  });
});
