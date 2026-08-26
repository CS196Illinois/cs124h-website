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

describe("sprints CRUD - sandbox mode", () => {
  beforeEach(clearAllTestTables);

  it("a web_dev with sandbox off behaves exactly like the real-table path", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "off" });
    asRole("web_dev", "webdev1");

    const res = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 1, goal: "Real" } }));
    expect(res.status).toBe(201);

    const { data } = await testClient().from(table("sprints")).select("*");
    expect(data).toHaveLength(1);
    const { data: overlay } = await testClient().from(table("sandboxOverlay")).select("*");
    expect(overlay).toHaveLength(0);
  });

  it("a sandboxed create writes to the overlay, never the real table", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    asRole("web_dev", "webdev1");

    const res = await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 1, goal: "Sandboxed" } }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.goal).toBe("Sandboxed");

    const { data: real } = await testClient().from(table("sprints")).select("*");
    expect(real).toHaveLength(0);

    const list = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(list.map((s) => s.goal)).toEqual(["Sandboxed"]);
  });

  it("a sandboxed GET merges the overlay onto real rows other users still see unsandboxed", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    const real = await insertSprint({ number: 1, goal: "Real sprint" });

    asRole("web_dev", "webdev1");
    await POST(makeRequest("http://localhost/api/sprints", { method: "POST", body: { number: 2, goal: "My sandbox sprint" } }));
    const sandboxedList = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(sandboxedList.map((s) => s.goal)).toEqual(["My sandbox sprint", "Real sprint"]);

    // A different, non-sandboxed viewer never sees it.
    asRole("course_lead", "lead1");
    const realList = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(realList.map((s) => s.goal)).toEqual(["Real sprint"]);
    void real;
  });

  it("a sandboxed edit to a real sprint doesn't touch the real row", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    const real = await insertSprint({ number: 1, goal: "Original" });
    asRole("web_dev", "webdev1");

    const patchRes = await PATCH(
      makeRequest(`http://localhost/api/sprints/${real.id}`, { method: "PATCH", body: { goal: "Edited in sandbox" } }),
      { params: { id: real.id } }
    );
    expect((await patchRes.json()).goal).toBe("Edited in sandbox");

    const { data: stillReal } = await testClient().from(table("sprints")).select("goal").eq("id", real.id).single();
    expect(stillReal.goal).toBe("Original");
  });

  it("a sandboxed delete of a real sprint doesn't touch the real row, and it disappears from the sandboxed view", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    const real = await insertSprint({ number: 1, goal: "Original" });
    asRole("web_dev", "webdev1");

    const delRes = await DELETE(makeRequest(`http://localhost/api/sprints/${real.id}`, { method: "DELETE" }), { params: { id: real.id } });
    expect(delRes.status).toBe(204);

    const list = await (await GET(makeRequest("http://localhost/api/sprints"))).json();
    expect(list).toHaveLength(0);

    const { data: stillReal } = await testClient().from(table("sprints")).select("id").eq("id", real.id).maybeSingle();
    expect(stillReal).not.toBeNull();
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

describe("sprint completions - sandbox mode", () => {
  beforeEach(clearAllTestTables);

  it("a sandboxed mark writes to the overlay, not the real table", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    const sprint = await insertSprint({ number: 1, goal: "Sprint 1" });
    asRole("web_dev", "webdev1");

    const res = await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    expect(res.status).toBe(201);

    const { data: real } = await testClient().from(table("sprintCompletions")).select("*").eq("sprint_id", sprint.id);
    expect(real).toHaveLength(0);

    const list = await (await GET_COMPLETIONS(makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`), { params: { id: sprint.id } })).json();
    expect(list.map((c) => c.student_net_id)).toEqual(["stu1"]);
  });

  it("re-marking the same student in sandbox mode updates in place, not a duplicate", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    const sprint = await insertSprint({ number: 1, goal: "Sprint 1" });
    asRole("web_dev", "webdev1");

    await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );
    await POST_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`, { method: "POST", body: { student_net_id: "stu1" } }),
      { params: { id: sprint.id } }
    );

    const list = await (await GET_COMPLETIONS(makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`), { params: { id: sprint.id } })).json();
    expect(list).toHaveLength(1);
  });

  it("sandboxing a real completion's removal doesn't touch the real row", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    const sprint = await insertSprint({ number: 1, goal: "Sprint 1" });
    await testClient().from(table("sprintCompletions")).insert({ sprint_id: sprint.id, student_net_id: "stu1", marked_by: "lead1" });
    asRole("web_dev", "webdev1");

    const del = await DELETE_COMPLETION(
      makeRequest(`http://localhost/api/sprints/${sprint.id}/completions?student_net_id=stu1`, { method: "DELETE" }),
      { params: { id: sprint.id } }
    );
    expect(del.status).toBe(204);

    const list = await (await GET_COMPLETIONS(makeRequest(`http://localhost/api/sprints/${sprint.id}/completions`), { params: { id: sprint.id } })).json();
    expect(list).toHaveLength(0);

    const { data: stillReal } = await testClient().from(table("sprintCompletions")).select("*").eq("sprint_id", sprint.id).eq("student_net_id", "stu1");
    expect(stillReal).toHaveLength(1);
  });
});
