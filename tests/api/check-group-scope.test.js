import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, insertActionItem, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET } = await import("../../app/api/action_items/route");
const { PATCH } = await import("../../app/api/action_items/[id]/route");
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

  it("a PM cannot grade another group's submission, even one they opened", async () => {
    asRole("pm", "pm1");
    expect((await grade(data.other.id, 8)).status).toBe(403);
  });

  it("course managers can grade every group's submissions", async () => {
    asRole("head_pm", "head1");
    expect((await grade(data.other.id, 9)).status).toBe(200);
  });
});

