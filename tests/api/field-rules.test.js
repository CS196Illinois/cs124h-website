import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, insertActionItem, clearAllTestTables } from "../helpers/db";
import { parseGroupNumber, parseSprintNumber, parseMaxScore, EVENT_TEXT_MAX } from "../../lib/fieldRules";

const { POST: POST_EVENT } = await import("../../app/api/events/route");
const { POST: POST_USER } = await import("../../app/api/users/route");
const { PATCH: PATCH_USER } = await import("../../app/api/users/[net_id]/route");
const { POST: POST_SPRINT } = await import("../../app/api/sprints/route");
const { PATCH: PATCH_SPRINT } = await import("../../app/api/sprints/[id]/route");
const { POST: POST_ITEM } = await import("../../app/api/action_items/route");
const { PATCH: PATCH_ITEM } = await import("../../app/api/action_items/[id]/route");

const json = (url, method, body) => makeRequest(`http://localhost${url}`, { method, body });

afterAll(clearAllTestTables);

describe("shared field rules", () => {
  it("parseGroupNumber keeps group 0, treats blank as unassigned, rejects bad input", () => {
    expect(parseGroupNumber(0)).toEqual({ value: 0 });
    expect(parseGroupNumber("0")).toEqual({ value: 0 });
    expect(parseGroupNumber("")).toEqual({ value: null });
    expect(parseGroupNumber(null)).toEqual({ value: null });
    for (const bad of [-1, "2.5", "abc", true]) expect(parseGroupNumber(bad).error).toBeTruthy();
  });

  it("parseSprintNumber requires a whole number", () => {
    expect(parseSprintNumber("0")).toEqual({ value: 0 });
    for (const bad of ["", null, undefined, -1, "1.5", true]) expect(parseSprintNumber(bad).error).toBeTruthy();
  });

  it("parseMaxScore defaults blank to 100 and rejects non-positive values", () => {
    expect(parseMaxScore("")).toEqual({ value: 100 });
    expect(parseMaxScore("12.5")).toEqual({ value: 12.5 });
    for (const bad of [0, -5, "abc"]) expect(parseMaxScore(bad).error).toBeTruthy();
  });
});

describe("API validation matches database requirements", () => {
  beforeEach(clearAllTestTables);

  it("events require a start time and respect the 255-character limits", async () => {
    await insertUser({ net_id: "lead1", role: "LEAD" });
    asRole("course_lead", "lead1");
    const noStart = await POST_EVENT(json("/api/events", "POST", { title: "Talk", audience_type: "all" }));
    expect(noStart.status).toBe(400);
    const longTitle = await POST_EVENT(json("/api/events", "POST", {
      title: "x".repeat(EVENT_TEXT_MAX + 1), start_time: new Date().toISOString(), audience_type: "all",
    }));
    expect(longTitle.status).toBe(400);
  });

  it("adding a user keeps group 0, and rejects blank NetIDs and invalid groups", async () => {
    await insertUser({ net_id: "lead1", role: "LEAD" });
    asRole("course_lead", "lead1");
    const created = await POST_USER(json("/api/users", "POST", { net_id: "stu0", role: "STUDENT", group_number: 0 }));
    expect(created.status).toBe(201);
    expect((await created.json()).group_number).toBe(0);
    expect((await POST_USER(json("/api/users", "POST", { net_id: "   ", role: "STUDENT" }))).status).toBe(400);
    expect((await POST_USER(json("/api/users", "POST", { net_id: "stu1", role: "STUDENT", group_number: -2 }))).status).toBe(400);
  });

  it("editing a user trims the name and stores a blank one as null", async () => {
    await insertUser({ net_id: "lead1", role: "LEAD" });
    await insertUser({ net_id: "stu1", role: "STUDENT", name: "Old", group_number: 0 });
    asRole("course_lead", "lead1");
    const res = await PATCH_USER(json("/api/users/stu1", "PATCH", { name: "   " }), { params: Promise.resolve({ net_id: "stu1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBeNull();
    expect(body.group_number).toBe(0);
  });

  it("sprints reject a blank number instead of saving sprint 0", async () => {
    await insertUser({ net_id: "lead1", role: "LEAD" });
    asRole("course_lead", "lead1");
    expect((await POST_SPRINT(json("/api/sprints", "POST", { number: "", goal: "Ship" }))).status).toBe(400);
    const sprint = await insertSprint({ number: 3, goal: "Ship" });
    const res = await PATCH_SPRINT(json(`/api/sprints/${sprint.id}`, "PATCH", { number: null }), { params: Promise.resolve({ id: sprint.id }) });
    expect(res.status).toBe(400);
  });

  it("action items reject a non-positive max score and an emptied title", async () => {
    await insertUser({ net_id: "lead1", role: "LEAD" });
    await insertUser({ net_id: "stu1", role: "STUDENT", group_number: 1 });
    asRole("course_lead", "lead1");
    const badScore = await POST_ITEM(json("/api/action_items", "POST", {
      title: "Essay", target_type: "individual", target_net_ids: ["stu1"], is_gradable: true, max_score: -5,
    }));
    expect(badScore.status).toBe(400);
    const item = await insertActionItem({ net_id: "stu1", assigned_by: "lead1", title: "Essay" });
    const res = await PATCH_ITEM(json(`/api/action_items/${item.id}`, "PATCH", { title: "  " }), { params: Promise.resolve({ id: item.id }) });
    expect(res.status).toBe(400);
  });
});
