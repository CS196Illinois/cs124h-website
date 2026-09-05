import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, insertSprintCheckWindow, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { PATCH } = await import("../../app/api/sprints/[id]/route");
const { GET } = await import("../../app/api/sprints/[id]/check/route");
const { POST: OPEN } = await import("../../app/api/sprints/[id]/check/open/route");
const { POST: CLOSE } = await import("../../app/api/sprints/[id]/check/close/route");
const { POST: SUBMIT } = await import("../../app/api/sprints/[id]/check/submit/route");

afterAll(clearAllTestTables);

const QUESTIONS = ["What did you decide, and why?", "What did you consider and reject?"];

async function seed() {
  await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
  await insertUser({ net_id: "stu1", role: "STUDENT", name: "Student One", group_number: 1 });
  await insertUser({ net_id: "stu2", role: "STUDENT", name: "Student Two", group_number: 2 });
  return insertSprint({ number: 1, goal: "Sprint 1" });
}

async function withQuestions(sprint) {
  asRole("course_lead", "lead1");
  await PATCH(
    makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "PATCH", body: { check_questions: QUESTIONS, check_max_score: 20 } }),
    { params: { id: sprint.id } },
  );
}

describe("understanding check: questions + gating", () => {
  beforeEach(clearAllTestTables);

  it("a student never sees the questions until their group's window is open", async () => {
    const sprint = await seed();
    await withQuestions(sprint);

    asRole("student", "stu1");
    const closed = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    expect(closed).toEqual({ hasCheck: true, isOpen: false, questions: null, maxScore: 20, mySubmission: null });

    asRole("pm", "pm1");
    await OPEN(makeRequest(`http://localhost/api/sprints/${sprint.id}/check/open`, { method: "POST", body: {} }), { params: { id: sprint.id } });

    asRole("student", "stu1");
    const open = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    expect(open.isOpen).toBe(true);
    expect(open.questions).toEqual(QUESTIONS);
  });

  it("a pm opens/closes only their own group; a manager can target any group", async () => {
    const sprint = await seed();
    await withQuestions(sprint);

    asRole("pm", "pm1");
    const foreign = await OPEN(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/open`, { method: "POST", body: { group_number: 2 } }),
      { params: { id: sprint.id } },
    );
    // A pm's own group is always used regardless of what's in the body.
    expect(foreign.status).toBe(200);
    const { data: window } = await testClient().from(table("sprintCheckWindows")).select("*").eq("group_number", 1).single();
    expect(window.is_open).toBe(true);

    asRole("course_lead", "lead1");
    const managed = await OPEN(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/open`, { method: "POST", body: { group_number: 2 } }),
      { params: { id: sprint.id } },
    );
    expect(managed.status).toBe(200);
    const { data: group2 } = await testClient().from(table("sprintCheckWindows")).select("*").eq("group_number", 2).single();
    expect(group2.is_open).toBe(true);
  });
});

describe("understanding check: submission", () => {
  beforeEach(clearAllTestTables);

  it("rejects a submission while the window is closed", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    asRole("student", "stu1");
    const res = await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["a", "b"] } }),
      { params: { id: sprint.id } },
    );
    expect(res.status).toBe(403);
  });

  it("rejects incomplete answers, then accepts a full submission and creates a gradable action item", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    await insertSprintCheckWindow({ sprint_id: sprint.id, group_number: 1, is_open: true, opened_by: "pm1" });

    asRole("student", "stu1");
    const incomplete = await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["only one"] } }),
      { params: { id: sprint.id } },
    );
    expect(incomplete.status).toBe(400);

    const res = await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["Because X.", "Considered Y, rejected it."] } }),
      { params: { id: sprint.id } },
    );
    expect(res.status).toBe(201);
    const item = await res.json();
    expect(item.is_gradable).toBe(true);
    expect(item.is_done).toBe(true);
    expect(item.max_score).toBe(20);
    expect(item.assigned_by).toBe("pm1");
    expect(item.description).toContain("Because X.");

    // Already submitted - rejected even though the window is still open.
    const dupe = await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["x", "y"] } }),
      { params: { id: sprint.id } },
    );
    expect(dupe.status).toBe(409);
  });

  it("a closed window still lets the student see their own past submission", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    await insertSprintCheckWindow({ sprint_id: sprint.id, group_number: 1, is_open: true, opened_by: "pm1" });
    asRole("student", "stu1");
    await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["a", "b"] } }),
      { params: { id: sprint.id } },
    );

    asRole("pm", "pm1");
    await CLOSE(makeRequest(`http://localhost/api/sprints/${sprint.id}/check/close`, { method: "POST", body: {} }), { params: { id: sprint.id } });

    asRole("student", "stu1");
    const after = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    expect(after.isOpen).toBe(false);
    expect(after.questions).toEqual(QUESTIONS);
    expect(after.mySubmission.answers).toEqual(["a", "b"]);
  });
});

describe("understanding check: web dev doubling as a PM", () => {
  beforeEach(clearAllTestTables);

  it("a web dev with a group gets their own group's roster and opens only that group", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    await insertUser({ net_id: "web1", role: "WEB", group_number: 1 });

    asRole("web_dev", "web1");
    const view = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    expect(view.groupNumber).toBe(1);
    expect(view.roster.map((r) => r.net_id)).toContain("stu1");
    expect(view.groups).toBeUndefined();

    const opened = await OPEN(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/open`, { method: "POST", body: { group_number: 2 } }),
      { params: { id: sprint.id } },
    );
    expect(opened.status).toBe(200);
    const { data: windows } = await testClient().from(table("sprintCheckWindows")).select("*");
    expect(windows).toHaveLength(1);
    expect(windows[0].group_number).toBe(1);
  });

  it("a web dev with no group still gets the manager all-groups view", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    await insertUser({ net_id: "web2", role: "WEB" });

    asRole("web_dev", "web2");
    const view = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    expect(Array.isArray(view.groups)).toBe(true);
    expect(view.groups.map((g) => g.groupNumber)).toEqual([1, 2]);
  });
});

describe("understanding check: manager roster view", () => {
  beforeEach(clearAllTestTables);

  it("course_lead sees every group's roster, including who hasn't submitted", async () => {
    const sprint = await seed();
    await withQuestions(sprint);
    await insertSprintCheckWindow({ sprint_id: sprint.id, group_number: 1, is_open: true, opened_by: "pm1" });
    asRole("student", "stu1");
    await SUBMIT(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/check/submit`, { method: "POST", body: { answers: ["a", "b"] } }),
      { params: { id: sprint.id } },
    );

    asRole("course_lead", "lead1");
    const summary = await (await GET(makeRequest(`http://localhost/api/sprints/${sprint.id}/check`), { params: { id: sprint.id } })).json();
    const g1 = summary.groups.find((g) => g.groupNumber === 1);
    const g2 = summary.groups.find((g) => g.groupNumber === 2);
    expect(g1.roster.find((r) => r.net_id === "stu1").submitted).toBe(true);
    expect(g2.roster.find((r) => r.net_id === "stu2").submitted).toBe(false);
  });
});
