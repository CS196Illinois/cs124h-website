import { it, expect } from "vitest";
import { registrationOpen } from "../../lib/courseData";
import { SITE } from "../../lib/siteConfig";

it("shows Register before the semester and through week 4, then hides it", () => {
  const start = SITE.semesterStart; // e.g. "2027-01-19"
  const day = (offset) => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  expect(registrationOpen([], day(-60))).toBe(true); // registering in the fall for spring
  expect(registrationOpen([], day(0))).toBe(true);   // first day of classes
  expect(registrationOpen([], day(27))).toBe(true);  // last day of week 4
  expect(registrationOpen([], day(28))).toBe(false); // week 5
});
