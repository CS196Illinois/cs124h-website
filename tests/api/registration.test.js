import { it, expect } from "vitest";
import { registrationOpen } from "../../lib/courseData";
import { termFor, semesterSortKey } from "../../lib/term";

const shift = (day, offset) => new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

it("works out each term's first day of classes from the calendar", () => {
  // Published Illinois first days of instruction.
  for (const day of ["2023-08-21", "2024-08-26", "2025-08-25", "2026-08-24", "2024-01-16", "2025-01-21", "2026-01-20", "2027-01-19"]) {
    expect(termFor(day).classesStart).toBe(day);
  }
  expect(termFor("2026-11-15").name).toBe("Fall 2026");
  expect(termFor("2027-03-01").name).toBe("Spring 2027");
  expect(termFor("2027-07-04").name).toBe("Fall 2027"); // summer points at the coming fall
});

it.each(["2026-08-24", "2027-01-19"])("shows Register from two weeks before classes (%s) through week 4", (start) => {
  expect(registrationOpen(shift(start, -15))).toBe(false);
  expect(registrationOpen(shift(start, -14))).toBe(true);
  expect(registrationOpen(start)).toBe(true);
  expect(registrationOpen(shift(start, 27))).toBe(true);  // last day of week 4
  expect(registrationOpen(shift(start, 28))).toBe(false); // week 5
});

it("orders semester labels newest first without a stored order", () => {
  const labels = ["Spring 2025", "Fall 2026", "Fall 2021", "Spring 2026"];
  expect(labels.sort((a, b) => semesterSortKey(b) - semesterSortKey(a))).toEqual(["Fall 2026", "Spring 2026", "Spring 2025", "Fall 2021"]);
});
