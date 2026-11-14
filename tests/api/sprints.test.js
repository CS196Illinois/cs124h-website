import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET, POST } = await import("../../app/api/sprints/route");
const { PATCH, DELETE } = await import("../../app/api/sprints/[id]/route");
const { GET: GET_COMPLETIONS, POST: POST_COMPLETION, DELETE: DELETE_COMPLETION } =
  await import("../../app/api/sprints/[id]/completions/route");

afterAll(clearAllTestTables);

describe("sprints CRUD", () => {
  beforeEach(clearAllTestTables);

  it("pm cannot create sprints (only course_lead/head_pm/web team)", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/sprints", {
      method: "POST", body: { number: 1, goal: "Ship it" },
    }));
    expect(res.status).toBe(403);
  });

  it("pm can append questions while preserving saved questions and scoring", async () => {
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
    const sprint = await insertSprint({ number: 1, goal: "Original", check_questions: ["Old question"], check_max_score: 10 });
    asRole("pm", "pm1");
    const updated = await PATCH(
      makeRequest(`http://localhost/api/sprints/${sprint.id}`, {
        method: "PATCH",
        body: { check_questions: ["Old question", "Follow-up"] },
      }),
      { params: { id: sprint.id } },
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).check_questions).toEqual(["Old question", "Follow-up"]);

    const forbidden = await PATCH(
      makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "PATCH", body: { goal: "Changed" } }),
      { params: { id: sprint.id } },
    );
    expect(forbidden.status).toBe(403);
  });

  it("hides future sprints from PMs while course leads can prepare them", async () => {
    await insertSprint({ number: 9, goal: "Future", start_date: "2099-01-01" });
    asRole("pm", "pm1");
    const pmRows = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(pmRows).toHaveLength(0);
    asRole("course_lead", "lead1");
    const leadRows = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(leadRows.some((s) => s.goal === "Future")).toBe(true);
  });

  it("creates, lists newest-number-first, updates, and deletes a sprint", async () => {
    asRole("course_lead", "lead1");
    await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 1, goal: "First" } }));
    const createRes = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 2, goal: "Second" } }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const list = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(list.map((s) => s.number)).toEqual([2, 1]);

    const patchRes = await PATCH(
      makeRequest(`http://localhost/api/sprints/${created.id}`, { method: "PATCH", body: { goal: "Updated goal" } }),
      { params: { id: created.id } }
    );
    expect((await patchRes.json()).goal).toBe("Updated goal");

    const delRes = await DELETE(makeRequest(`http://localhost/api/sprints/${created.id}`, { method: "DELETE" }), { params: { id: created.id } });
    expect(delRes.status).toBe(204);
  });

  it("rejects a sprint number that is already used, on create and on edit", async () => {
    const one = await insertSprint({ number: 1, goal: "One" });
    const two = await insertSprint({ number: 2, goal: "Two" });
    asRole("course_lead", "lead1");
    const dup = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 1, goal: "Dup" } }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe("Sprint 1 already exists. Choose a different number.");

    const clash = await PATCH(makeRequest(`http://localhost/api/sprints/${two.id}`, { method: "PATCH", body: { number: 1 } }), { params: { id: two.id } });
    expect(clash.status).toBe(409);
    // Saving a sprint with its own unchanged number is fine.
    const same = await PATCH(makeRequest(`http://localhost/api/sprints/${one.id}`, { method: "PATCH", body: { number: 1, goal: "One again" } }), { params: { id: one.id } });
    expect(same.status).toBe(200);
    const { data } = await testClient().from(table("sprints")).select("number");
    expect(data.map((r) => r.number).sort()).toEqual([1, 2]);
  });

  it("requires number and goal on create", async () => {
    asRole("course_lead", "lead1");
    const res = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { goal: "" } }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid sprint numbers and reversed or malformed date ranges", async () => {
    asRole("course_lead", "lead1");
    for (const body of [
      { number: -1, goal: "Bad number" },
      { number: 1, goal: "Reversed", start_date: "2026-09-20", end_date: "2026-09-19" },
      { number: 2, goal: "Malformed", start_date: "09/20/2026" },
      { number: 3, goal: "Impossible date", start_date: "2026-02-30" },
      { number: 4, goal: "Bad score", check_max_score: 0 },
    ]) {
      const res = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body }));
      expect(res.status).toBe(400);
    }
  });

  it("does not let non-course-leads mutate or delete a future sprint by id", async () => {
    const sprint = await insertSprint({ number: 9, goal: "Future", start_date: "2099-01-01" });
    asRole("pm", "pm1");
    const patchRes = await PATCH(
      makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "PATCH", body: { check_questions: ["Hidden"] } }),
      { params: { id: sprint.id } },
    );
    expect(patchRes.status).toBe(404);
    const deleteRes = await DELETE(makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "DELETE" }), { params: { id: sprint.id } });
    expect(deleteRes.status).toBe(403);
  });

  it("PMs cannot edit, disable, reorder, delete, or change the score of lead checks", async () => {
    const sprint = await insertSprint({ check_questions: ["Lead-only question", "Second question"], check_max_score: 20 });
    asRole("pm", "pm1");
    for (const body of [
      { check_questions: null }, { check_questions: [] },
      { check_questions: ["Edited", "Second question"] },
      { check_questions: ["Second question", "Lead-only question"] },
      { check_max_score: 100 },
    ]) {
      const response = await PATCH(makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "PATCH", body }), { params: { id: sprint.id } });
      expect(response.status).toBe(403);
    }
    expect((await DELETE(makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "DELETE" }), { params: { id: sprint.id } })).status).toBe(403);
    const rows = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(rows[0].check_questions).toEqual(["Lead-only question", "Second question"]);
    asRole("course_lead", "lead1");
    expect((await PATCH(makeRequest(`http://localhost/api/sprints/${sprint.id}`, { method: "PATCH", body: { check_questions: ["Updated by lead"] } }), { params: { id: sprint.id } })).status).toBe(200);
  });
});

describe("sprint completions", () => {
  beforeEach(clearAllTestTables);

  async function seed() {
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
    await insertUser({ net_id: "stu1", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "stu2", role: "STUDENT", group_number: 2 });
    return insertSprint({ number: 1, goal: "Sprint 1" });
  }

  it("a pm can mark a student in their own group complete, but not one outside it", async () => {
    const sprint = await seed();
    asRole("pm", "pm1");

    const ok = await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    expect(ok.status).toBe(201);
    const okJson = await ok.json();
    expect(okJson.marked_by).toBe("pm1");

    const blocked = await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu2" } }),
      { params: { id: sprint.id } }
    );
    expect(blocked.status).toBe(403);
  });

  it("re-marking the same student upserts rather than duplicating", async () => {
    const sprint = await seed();
    asRole("pm", "pm1");
    await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    const list = await (await GET_COMPLETIONS(makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`), { params: { id: sprint.id } })).json();
    expect(list.length).toBe(1);
  });

  it("removes a completion", async () => {
    const sprint = await seed();
    asRole("pm", "pm1");
    await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    const del = await DELETE_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions?student_net_id=stu1`, { method: "DELETE" }),
      { params: { id: sprint.id } }
    );
    expect(del.status).toBe(204);
    const list = await (await GET_COMPLETIONS(makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`), { params: { id: sprint.id } })).json();
    expect(list.length).toBe(0);
  });
});

