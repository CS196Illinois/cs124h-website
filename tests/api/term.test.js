import { it, expect } from "vitest";
import { termFor, semesterSortKey } from "../../lib/term";
it("works out each term's first day of classes from the calendar", () => {
  // Published Illinois first days of instruction.
  for (const day of ["2023-08-21", "2024-08-26", "2025-08-25", "2026-08-24", "2024-01-16", "2025-01-21", "2026-01-20", "2027-01-19"]) {
    expect(termFor(day).classesStart).toBe(day);
  }
  expect(termFor("2026-11-15").name).toBe("Fall 2026");
  expect(termFor("2027-03-01").name).toBe("Spring 2027");
  expect(termFor("2027-07-04").name).toBe("Fall 2027"); // summer points at the coming fall
});

it("orders semester labels newest first without a stored order", () => {
  const labels = ["Spring 2025", "Fall 2026", "Fall 2021", "Spring 2026"];
  expect(labels.sort((a, b) => semesterSortKey(b) - semesterSortKey(a))).toEqual(["Fall 2026", "Spring 2026", "Spring 2025", "Fall 2021"]);
});
