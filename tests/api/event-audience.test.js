import { describe, it, expect } from "vitest";
import { audienceMatches } from "../../lib/events";
import { isStaffAudience, STAFF_AUDIENCE } from "../../lib/eventAudience";

describe("event audience matching", () => {
  it("allows everyone and exact people", () => {
    expect(audienceMatches({ audience_type: "all" }, { netID: "any", role: "student" })).toBe(true);
    expect(audienceMatches({ audience_type: "people", audience_values: ["s1"] }, { netID: "s1", role: "student" })).toBe(true);
    expect(audienceMatches({ audience_type: "people", audience_values: ["s1"] }, { netID: "s2", role: "student" })).toBe(false);
  });
  it("matches canonical roles and groups", () => {
    expect(audienceMatches({ audience_type: "roles", audience_values: ["PM", "HEAD"] }, { netID: "p", role: "pm" })).toBe(true);
    expect(audienceMatches({ audience_type: "roles", audience_values: ["STUDENT"] }, { netID: "p", role: "pm" })).toBe(false);
    expect(audienceMatches({ audience_type: "groups", audience_values: ["4"] }, { netID: "s", role: "student", groupNumber: 4 })).toBe(true);
    expect(audienceMatches({ audience_type: "groups", audience_values: ["4"] }, { netID: "s", role: "student", groupNumber: 5 })).toBe(false);
  });
  it("treats an all-staff audience as every role except students", () => {
    expect(isStaffAudience(STAFF_AUDIENCE)).toBe(true);
    expect(isStaffAudience({ audience_type: "roles", audience_values: ["WEB", "LEAD_WEB"] })).toBe(false);
    for (const role of ["course_lead", "head_pm", "lead_web_dev", "pm", "web_dev"]) {
      expect(audienceMatches(STAFF_AUDIENCE, { netID: "x", role })).toBe(true);
    }
    expect(audienceMatches(STAFF_AUDIENCE, { netID: "x", role: "student" })).toBe(false);
  });
});
