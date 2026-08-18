import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSprint, clearAllTestTables } from "../helpers/db";

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

  it("requires number and goal on create", async () => {
    asRole("course_lead", "lead1");
    const res = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { goal: "" } }));
    expect(res.status).toBe(400);
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
