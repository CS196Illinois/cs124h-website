import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, insertActionItem, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

// action_items now only holds understanding-check submissions (plus legacy
// rows from the removed assignment feature): GET lists them for the gradebook
// and PATCH grades them.
const { GET } = await import("../../app/api/action_items/route");
const { PATCH } = await import("../../app/api/action_items/[id]/route");

afterAll(clearAllTestTables);

async function seedGroup() {
  await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
  await insertUser({ net_id: "pm2", role: "PM", group_number: 2 });
  await insertUser({ net_id: "head1", role: "HEAD" });
  await insertUser({ net_id: "lead1", role: "LEAD" });
  await insertUser({ net_id: "stu1", role: "STUDENT", group_number: 1 });
  await insertUser({ net_id: "stu2", role: "STUDENT", group_number: 1 });
  await insertUser({ net_id: "stu3", role: "STUDENT", group_number: 2 });
}

let sprint;
async function seed() {
  await clearAllTestTables();
  await seedGroup();
  sprint = await insertSprint({ number: 1, goal: "Scope", start_date: "2000-01-01", end_date: "2999-01-01", check_questions: ["Q"] });
}

// A submitted understanding check, shaped like check/submit/route.js writes it.
const insertCheck = (overrides) => insertActionItem({
  assigned_by: "pm1", title: "Sprint 1 Understanding Check", is_done: true, is_gradable: true, max_score: 100,
  sprint_id: sprint.id, batch_id: sprint.id, completion_date: new Date().toISOString(), ...overrides,
});

const patch = (item, body) => PATCH(makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body }), { params: { id: item.id } });

describe("GET /api/action_items", () => {
  beforeEach(seed);

  it("students always see only their own items", async () => {
    await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "for stu1" });
    await insertActionItem({ net_id: "stu2", assigned_by: "pm1", title: "for stu2" });
    asRole("student", "stu1");

    const res = await GET(makeRequest("http://localhost/api/action_items?scope=all"));
    const json = await res.json();
    expect(json.map((i) => i.net_id)).toEqual(["stu1"]);
  });

  it("scope=mine returns own assignments; full access remains available to course leads", async () => {
    await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "a" });
    await insertActionItem({ net_id: "stu3", assigned_by: "pm2", title: "b" });
    asRole("pm", "pm1");

    const mine = await (await GET(makeRequest("http://localhost/api/action_items?scope=mine"))).json();
    expect(mine.map((i) => i.title)).toEqual(["a"]);

    asRole("course_lead", "lead1");
    const all = await (await GET(makeRequest("http://localhost/api/action_items?scope=all"))).json();
    expect(all.length).toBe(2);
  });

  it("PMs cannot retrieve other groups' grades with scope=all", async () => {
    await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "Own group" });
    await insertActionItem({ net_id: "stu3", assigned_by: "pm2", title: "Other group" });
    asRole("pm", "pm1");
    const res = await GET(makeRequest("http://localhost/api/action_items?scope=all"));
    expect(res.status).toBe(200);
    expect((await res.json()).map((i) => i.title)).toEqual(["Own group"]);
  });
});

describe("PATCH /api/action_items/[id] (grading)", () => {
  beforeEach(seed);

  it("students cannot grade", async () => {
    const item = await insertCheck({ net_id: "stu1" });
    asRole("student", "stu1");
    expect((await patch(item, { grade: 100 })).status).toBe(403);
  });

  it("only accepts a grade", async () => {
    const item = await insertCheck({ net_id: "stu1" });
    asRole("pm", "pm1");
    expect((await patch(item, { title: "renamed" })).status).toBe(400);
    expect((await patch(item, { is_done: false })).status).toBe(400);
  });

  it("rejects grading a legacy assignment, a non-gradable check, or an unsubmitted check", async () => {
    const legacy = await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "old", is_gradable: true, max_score: 100, is_done: true });
    const notGradable = await insertCheck({ net_id: "stu1", is_gradable: false });
    const notDone = await insertCheck({ net_id: "stu2", is_done: false, completion_date: null });
    asRole("pm", "pm1");
    for (const item of [legacy, notGradable, notDone]) expect((await patch(item, { grade: 5 })).status).toBe(400);
  });

  it("a PM cannot grade another group's check", async () => {
    const item = await insertCheck({ net_id: "stu3", assigned_by: "pm1" });
    asRole("pm", "pm1");
    expect((await patch(item, { grade: 90 })).status).toBe(403);
  });

  it("rejects a grade above max_score, accepts a valid one, and records graded_by/graded_at", async () => {
    const item = await insertCheck({ net_id: "stu1" });
    asRole("pm", "pm1");

    expect((await patch(item, { grade: 150 })).status).toBe(400);

    const json = await (await patch(item, { grade: 92, grade_note: "nice work" })).json();
    expect(json.grade).toBe(92);
    expect(json.graded_by).toBe("pm1");
    expect(json.graded_at).toBeTruthy();
    expect(json.grade_note).toBe("nice work");
  });

  it("rejects blank, boolean, and object grades without changing the score", async () => {
    const item = await insertCheck({ net_id: "stu1", grade: 90 });
    asRole("pm", "pm1");
    for (const grade of ["", "  ", false, [], {}]) expect((await patch(item, { grade })).status).toBe(400);
    const { data } = await testClient().from(table("actionItems")).select("grade").eq("id", item.id).single();
    expect(data.grade).toBe(90);
  });

  it("clears feedback with a cleared grade", async () => {
    const item = await insertCheck({ net_id: "stu1", grade: 90, grade_note: "Old feedback" });
    asRole("pm", "pm1");
    const res = await patch(item, { grade: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ grade: null, grade_note: null, graded_at: null });
  });
});

describe("grading in sandbox mode", () => {
  beforeEach(async () => {
    await seed();
    await insertUser({ net_id: "webdev1", role: "WEB", group_number: 1, sandbox_mode: "persistent" });
  });

  it("a sandboxed grade writes to the overlay, not the real row", async () => {
    const item = await insertCheck({ net_id: "stu1" });
    asRole("web_dev", "webdev1");

    const res = await patch(item, { grade: 77 });
    expect(res.status).toBe(200);
    expect((await res.json()).grade).toBe(77);

    const { data: stillReal } = await testClient().from(table("actionItems")).select("grade").eq("id", item.id).single();
    expect(stillReal.grade).toBeNull();
  });
});
