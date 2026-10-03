import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, insertActionItem, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET } = await import("../../app/api/action_items/route");
const { PATCH, DELETE } = await import("../../app/api/action_items/[id]/route");
const { PATCH: PATCH_BATCH, DELETE: DELETE_BATCH } = await import("../../app/api/action_items/batch/[batchId]/route");
const { GET: CHECK } = await import("../../app/api/sprints/[id]/check/route");
const { PATCH: PATCH_SPRINT } = await import("../../app/api/sprints/[id]/route");
const { POST: ADD_BANK } = await import("../../app/api/sprint-question-bank/route");

afterAll(clearAllTestTables);

// Understanding-check submissions share the sprint id as their batch_id across
// every group, and record whoever opened the window as their assigner.
async function seed() {
  await clearAllTestTables();
  await insertUser({ net_id: "lead1", role: "LEAD" });
  await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
  await insertUser({ net_id: "pm2", role: "PM", group_number: 2 });
  await insertUser({ net_id: "web1", role: "WEB", group_number: 1, sandbox_mode: "off" });
  await insertUser({ net_id: "stu1", role: "STUDENT", group_number: 1 });
  await insertUser({ net_id: "stu2", role: "STUDENT", group_number: 2 });
  const sprint = await insertSprint({ number: 1, goal: "Scope", start_date: "2000-01-01", end_date: "2999-01-01", check_questions: ["Q"] });
  const check = (net_id, assigned_by) => insertActionItem({
    net_id, assigned_by, title: "Sprint 1 Understanding Check", is_done: true, is_gradable: true, max_score: 10,
    sprint_id: sprint.id, batch_id: sprint.id, completion_date: new Date().toISOString(),
  });
  // Group 1's check was opened by a course lead; pm1 also opened group 2's.
  return { sprint, own: await check("stu1", "lead1"), other: await check("stu2", "pm1") };
}

const grade = (id, value) => PATCH(makeRequest(`http://localhost/api/action_items/${id}`, { method: "PATCH", body: { grade: value } }), { params: Promise.resolve({ id }) });

describe("PMs only view and manage their own group's understanding checks", () => {
  let data;
  beforeEach(async () => { data = await seed(); });

  it("a PM grades their group's submission even when someone else opened the check", async () => {
    asRole("pm", "pm1");
    expect((await grade(data.own.id, 8)).status).toBe(200);
  });

  it("a PM cannot grade or delete another group's submission, even one they opened", async () => {
    asRole("pm", "pm1");
    expect((await grade(data.other.id, 8)).status).toBe(403);
    const del = await DELETE(makeRequest(`http://localhost/api/action_items/${data.other.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: data.other.id }) });
    expect(del.status).toBe(403);
  });

  it("a web dev acting as a PM is held to the same group scope", async () => {
    asRole("web_dev", "web1");
    expect((await grade(data.own.id, 7)).status).toBe(200);
    expect((await grade(data.other.id, 7)).status).toBe(403);
    const listed = await (await GET(makeRequest("http://localhost/api/action_items?scope=all"))).json();
    expect(listed.filter((item) => item.sprint_id).map((item) => item.net_id)).toEqual(["stu1"]);
  });

  it("course managers can grade every group's submissions", async () => {
    asRole("head_pm", "head1");
    expect((await grade(data.other.id, 9)).status).toBe(200);
  });

  it("batch grading a sprint's checks only reaches the PM's own group", async () => {
    asRole("pm", "pm1");
    const res = await PATCH_BATCH(makeRequest(`http://localhost/api/action_items/batch/${data.sprint.id}`, {
      method: "PATCH", body: { grades: [{ id: data.own.id, grade: 6 }, { id: data.other.id, grade: 6 }] },
    }), { params: Promise.resolve({ batchId: data.sprint.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.updated).toBe(1);
    expect(json.skipped.map((entry) => entry.id)).toEqual([data.other.id]);
    const { data: rows } = await testClient().from(table("actionItems")).select("net_id, grade").eq("batch_id", data.sprint.id);
    expect(Object.fromEntries(rows.map((row) => [row.net_id, row.grade]))).toEqual({ stu1: 6, stu2: null });
  });

  it("deleting a sprint's check batch only removes the PM's own group's submissions", async () => {
    asRole("pm", "pm1");
    const res = await DELETE_BATCH(makeRequest(`http://localhost/api/action_items/batch/${data.sprint.id}`, { method: "DELETE" }), { params: Promise.resolve({ batchId: data.sprint.id }) });
    expect(res.status).toBe(200);
    const { data: rows } = await testClient().from(table("actionItems")).select("net_id").eq("batch_id", data.sprint.id);
    expect(rows.map((row) => row.net_id)).toEqual(["stu2"]);
  });
});

describe("a lead web dev previewing the PM page sees and edits it as a PM", () => {
  let data;
  beforeEach(async () => {
    data = await seed();
    await insertUser({ net_id: "leadweb", role: "LEAD_WEB", group_number: 1, sandbox_mode: "off" });
    asRole("lead_web_dev", "leadweb");
  });

  it("gets only their own group, as a PM does, but the course-wide view without view=pm", async () => {
    const check = (query) => CHECK(makeRequest(`http://localhost/api/sprints/${data.sprint.id}/check${query}`), { params: Promise.resolve({ id: data.sprint.id }) });
    const pm = await (await check("?view=pm")).json();
    expect(pm.groupNumber).toBe(1);
    expect(pm.roster.map((row) => row.net_id)).toEqual(["stu1"]);
    expect(pm.groups).toBeUndefined();
    const all = await (await check("")).json();
    expect(all.groups.map((group) => group.groupNumber)).toEqual([1, 2]);
  });

  it("adds questions to their group, never to the course-wide sprint", async () => {
    const res = await PATCH_SPRINT(makeRequest(`http://localhost/api/sprints/${data.sprint.id}?view=pm`, { method: "PATCH", body: { check_questions: ["Q", "Group only"] } }), { params: Promise.resolve({ id: data.sprint.id }) });
    expect(res.status).toBe(200);
    const { data: sprint } = await testClient().from(table("sprints")).select("check_questions").eq("id", data.sprint.id).single();
    expect(sprint.check_questions).toEqual(["Q"]);
    const { data: group } = await testClient().from(table("sprintGroupChecks")).select("additional_questions").eq("sprint_id", data.sprint.id).eq("group_number", 1).single();
    expect(group.additional_questions).toEqual(["Group only"]);

    const bank = await ADD_BANK(makeRequest("http://localhost/api/sprint-question-bank?view=pm", { method: "POST", body: { question: `Preview bank question ${Date.now()}` } }));
    expect(bank.status).toBe(201);
    expect((await bank.json()).group_number).toBe(1);
  });
});
