import { describe, it, expect } from "vitest";
import { defaultSprintDates } from "../../lib/sprintVisibility";

describe("defaultSprintDates", () => {
  it("starts the day after the latest sprint and keeps its length", () => {
    const sprints = [
      { number: 3, start_date: "2026-10-05", end_date: "2026-10-11" },
      { number: 2, start_date: "2026-09-28", end_date: "2026-10-04" },
    ];
    expect(defaultSprintDates(sprints, "2026-10-10")).toEqual({ start_date: "2026-10-12", end_date: "2026-10-18" });
  });

  it("crosses month and year boundaries", () => {
    expect(defaultSprintDates([{ start_date: "2026-12-21", end_date: "2026-12-31" }])).toEqual({ start_date: "2027-01-01", end_date: "2027-01-11" });
  });

  it("falls back to a week from today when no sprint has dates", () => {
    expect(defaultSprintDates([{ number: 0, start_date: null, end_date: null }], "2026-10-10")).toEqual({ start_date: "2026-10-10", end_date: "2026-10-16" });
    expect(defaultSprintDates([], "2026-10-10")).toEqual({ start_date: "2026-10-10", end_date: "2026-10-16" });
  });
});
