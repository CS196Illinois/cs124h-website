import { beforeEach, describe, expect, it, vi } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";

// In-memory database boundary lets these API regressions run before migration.
const db = vi.hoisted(() => ({ rows: {}, writes: [], reads: [] }));
vi.mock("../../lib/supabaseServer", () => {
  const client = { from(name) {
    let predicates = [], single = false, action, payload, conflict;
    const query = {
      select() { return query; },
      order() { return query; },
      eq(key, value) { predicates.push((r) => r[key] === value); return query; },
      is(key, value) { predicates.push((r) => (r[key] ?? null) === value); return query; },
      in(key, values) { predicates.push((r) => values.includes(r[key])); return query; },
      or(expression) {
        const group = Number(expression.split("group_number.eq.")[1]);
        predicates.push((r) => r.group_number == null || r.group_number === group);
        return query;
      },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      update(row) { action = "update"; payload = row; return query; },
      insert(row) { action = "insert"; payload = row; return query; },
      upsert(row, options) { action = "upsert"; payload = row; conflict = options.onConflict.split(","); return query; },
      then(resolve, reject) {
        try {
          const rows = db.rows[name] ??= [];
          let result = rows.filter((r) => predicates.every((p) => p(r)));
          if (!action) db.reads.push({ name, rows: structuredClone(result) });
          if (action) {
            db.writes.push({ name, action, payload });
            if (action === "update") result.forEach((r) => Object.assign(r, payload));
            else {
              let row = action === "upsert" && rows.find((r) => conflict.every((key) => r[key] === payload[key]));
              if (row) Object.assign(row, payload);
              else { row = { id: `generated-${rows.length}`, ...payload }; rows.push(row); }
              result = [row];
            }
          }
          return Promise.resolve({ data: structuredClone(single ? result[0] ?? null : result), error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
  return { supabaseServer: client, getSupabaseServer: () => client };
});

const { PATCH } = await import("../../app/api/sprints/[id]/route");
const { GET: LIST } = await import("../../app/api/sprints/route");
const { GET: CHECK } = await import("../../app/api/sprints/[id]/check/route");
const { POST: SUBMIT } = await import("../../app/api/sprints/[id]/check/submit/route");
const { GET: BANK, POST: ADD } = await import("../../app/api/sprint-question-bank/route");
const params = { params: { id: "sprint" } };
const request = (body) => makeRequest("http://localhost/api/sprints/sprint", { method: "PATCH", body });
const customize = (questions, extra = {}) => PATCH(request({ check_questions: questions, ...extra }), params);
const view = async (role, netID) => {
  asRole(role, netID);
  return (await CHECK(makeRequest("http://localhost/api/sprints/sprint/check"), params)).json();
};

beforeEach(() => {
  db.writes = [];
  db.reads = [];
  db.rows = {
    test_sprints: [{ id: "sprint", number: 1, check_questions: ["Required"], check_max_score: 20 }],
    test_users: [
      { net_id: "pm1", role: "PM", group_number: 1 },
      { net_id: "pm2", role: "PM", group_number: 2 },
      { net_id: "copm", role: "PM", group_number: 1 },
      { net_id: "student1", role: "STUDENT", group_number: 1 },
      { net_id: "student2", role: "STUDENT", group_number: 2 },
    ],
    test_sprint_check_windows: [1, 2].map((group_number) => ({ sprint_id: "sprint", group_number, is_open: true, opened_by: `pm${group_number}` })),
    test_sprint_question_bank: [{ id: "shared", question: "Shared bank question", group_number: null }],
  };
});

describe("group understanding-check isolation", () => {
  it.each(["pm", "web_dev"])("scopes %s edits to their actual group, ignoring a supplied group", async (role) => {
    asRole(role, "pm1");
    const saved = await customize(["Required", "Group one"], { group_number: 2 });
    expect(saved.status).toBe(200);
    expect((await saved.json()).check_questions).toEqual(["Required", "Group one"]);
    expect(db.rows.test_sprints[0].check_questions).toEqual(["Required"]);
    expect((await view("pm", "pm2")).questions).toEqual(["Required"]);
    expect((await view("pm", "copm")).questions).toEqual(["Required", "Group one"]);
    expect((await view("student", "student1")).questions).toEqual(["Required", "Group one"]);
    expect((await view("student", "student2")).questions).toEqual(["Required"]);
    asRole("pm", "pm1");
    expect((await (await LIST()).json())[0].check_questions).toEqual(["Required", "Group one"]);
    asRole("pm", "pm2");
    expect((await (await LIST()).json())[0].check_questions).toEqual(["Required"]);
  });

  it("allows revising/removing group additions while protecting shared questions and scores", async () => {
    asRole("pm", "pm1");
    await customize(["Required", "First"]);
    expect((await customize(["Required", "Revised"])).status).toBe(200);
    expect((await view("student", "student1")).questions).toEqual(["Required", "Revised"]);
    asRole("pm", "pm1");
    expect((await customize(["Changed required"])).status).toBe(403);
    expect((await customize(["Required"], { check_max_score: 99 })).status).toBe(403);
    expect((await customize(["Required"])).status).toBe(200);
    expect((await view("student", "student1")).questions).toEqual(["Required"]);
  });

  it("rejects unassigned PMs instead of writing shared questions", async () => {
    asRole("pm", "unassigned");
    expect((await customize(["Required", "Private"])).status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });

  it("validates submissions against the student's group and preserves submitted questions after edits", async () => {
    asRole("pm", "pm1");
    await customize(["Required", "Group one"]);
    asRole("student", "student1");
    expect((await SUBMIT(request({ answers: ["A"] }), params)).status).toBe(400);
    const response = await SUBMIT(request({ answers: ["A", "B"] }), params);
    expect(response.status).toBe(201);
    expect((await response.json()).additional_info.questions).toEqual(["Required", "Group one"]);
    asRole("student", "student2");
    expect((await SUBMIT(request({ answers: ["A"] }), params)).status).toBe(201);
    asRole("pm", "pm1");
    await customize(["Required", "Replacement"]);
    expect((await view("student", "student1")).questions).toEqual(["Required", "Group one"]);
  });

  it("supports group-only checks and keeps closed checks gated", async () => {
    db.rows.test_sprints[0].check_questions = null;
    asRole("pm", "pm1");
    await customize(["Only group one"]);
    expect((await view("student", "student2")).hasCheck).toBe(false);
    db.rows.test_sprint_check_windows[0].is_open = false;
    expect((await view("student", "student1")).questions).toBeNull();
    const manager = await view("course_lead", "lead");
    expect(manager.hasCheck).toBe(true);
    expect(manager.groups.find((g) => g.groupNumber === 1).questions).toEqual(["Only group one"]);
  });

  it("keeps group additions when a course lead updates shared questions", async () => {
    asRole("pm", "pm1");
    await customize(["Required", "Group one"]);
    asRole("course_lead", "lead");
    expect((await customize(["New required"])).status).toBe(200);
    expect((await view("student", "student1")).questions).toEqual(["New required", "Group one"]);
    expect((await view("student", "student2")).questions).toEqual(["New required"]);
  });

  it("keeps sandboxed web-dev additions out of the group's live check", async () => {
    db.rows.test_users[0].sandbox_mode = "persistent";
    asRole("web_dev", "pm1");
    expect((await customize(["Required", "Sandbox question"])).status).toBe(200);
    expect((await view("web_dev", "pm1")).questions).toEqual(["Required", "Sandbox question"]);
    expect((await view("pm", "copm")).questions).toEqual(["Required"]);
    expect((await view("student", "student1")).questions).toEqual(["Required"]);
    expect(db.rows.test_sprint_group_checks).toHaveLength(0);
  });

  it("batches manager group reads instead of issuing one query per group", async () => {
    for (let group = 3; group <= 50; group++) {
      db.rows.test_users.push({ net_id: `student${group}`, role: "STUDENT", group_number: group });
    }
    const result = await view("course_lead", "lead");
    expect(result.groups).toHaveLength(50);
    expect(db.reads.filter((r) => r.name === "test_sprint_group_checks")).toHaveLength(1);
  });

  it("loads only a student's own submission and looks up their group once", async () => {
    db.rows.test_action_items = [
      { id: "mine", sprint_id: "sprint", net_id: "student1" },
      { id: "foreign", sprint_id: "sprint", net_id: "student2" },
    ];
    await view("student", "student1");
    expect(db.reads.filter((r) => r.name === "test_users")).toHaveLength(1);
    const reads = db.reads.filter((r) => r.name === "test_action_items");
    expect(reads).toHaveLength(1);
    expect(reads[0].rows.map((r) => r.id)).toEqual(["mine"]);
  });

  it("shows shared bank entries plus only the current group's additions", async () => {
    asRole("pm", "pm1");
    expect((await ADD(request({ question: "Group bank", group_number: 2 }))).status).toBe(201);
    expect((await (await BANK()).json()).map((q) => q.question)).toEqual(["Shared bank question", "Group bank"]);
    asRole("pm", "copm");
    expect((await (await BANK()).json()).map((q) => q.question)).toContain("Group bank");
    for (const [role, user] of [["pm", "pm2"], ["course_lead", "lead"]]) {
      asRole(role, user);
      expect((await (await BANK()).json()).map((q) => q.question)).toEqual(["Shared bank question"]);
    }
  });
});
