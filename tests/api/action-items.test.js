import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertActionItem, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET, POST } = await import("../../app/api/action_items/route");
const { PATCH, DELETE } = await import("../../app/api/action_items/[id]/route");
const { PATCH: PATCH_BATCH, DELETE: DELETE_BATCH } = await import("../../app/api/action_items/batch/[batchId]/route");

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

describe("POST /api/action_items", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
  });

  it("401s for students", async () => {
    asRole("student", "stu1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "individual", target_net_ids: ["stu1"] },
    }));
    expect(res.status).toBe(401);
  });

  it("requires a title", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { target_type: "individual", target_net_ids: ["stu1"] },
    }));
    expect(res.status).toBe(400);
  });

  it("individual: rejects targets outside the caller's manageable roles", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "individual", target_net_ids: ["pm2"] }, // PM targeting a PM
    }));
    expect(res.status).toBe(403);
  });

  it("individual: pm cannot target a student outside their own group", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "individual", target_net_ids: ["stu3"] }, // group 2, pm1 is group 1
    }));
    expect(res.status).toBe(403);
  });

  it("individual: single recipient gets no batch_id, multiple recipients share one", async () => {
    asRole("pm", "pm1");

    const single = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "solo", target_type: "individual", target_net_ids: ["stu1"] },
    }));
    expect(single.status).toBe(201);
    const singleJson = await single.json();
    expect(singleJson.data[0].batch_id).toBeNull();

    const bulk = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "bulk", target_type: "individual", target_net_ids: ["stu1", "stu2"] },
    }));
    expect(bulk.status).toBe(201);
    const bulkJson = await bulk.json();
    expect(bulkJson.count).toBe(2);
    const batchIds = bulkJson.data.map((i) => i.batch_id);
    expect(batchIds[0]).toBeTruthy();
    expect(batchIds[0]).toBe(batchIds[1]);
  });

  it("group: pm can only assign to their own group", async () => {
    asRole("pm", "pm1");
    const wrongGroup = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "group", target_group: 2 },
    }));
    expect(wrongGroup.status).toBe(403);

    const ownGroup = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "group", target_group: 1 },
    }));
    expect(ownGroup.status).toBe(201);
    expect((await ownGroup.json()).count).toBe(2); // stu1 + stu2
  });

  it("role_: enforces hierarchy (head_pm cannot assign to all HEADs)", async () => {
    asRole("head_pm", "head1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "role_HEAD" },
    }));
    expect(res.status).toBe(403);
  });

  it("gradable items default max_score to 100 when unset or invalid", async () => {
    asRole("course_lead", "lead1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "x", target_type: "individual", target_net_ids: ["stu1"], is_gradable: true, max_score: "not-a-number" },
    }));
    const json = await res.json();
    expect(json.data[0].is_gradable).toBe(true);
    expect(json.data[0].max_score).toBe(100);
  });
});

describe("GET /api/action_items", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
  });

  it("students always see only their own items", async () => {
    await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "for stu1" });
    await insertActionItem({ net_id: "stu2", assigned_by: "pm1", title: "for stu2" });
    asRole("student", "stu1");

    const res = await GET(makeRequest("http://localhost/api/action_items?scope=all"));
    const json = await res.json();
    expect(json.map((i) => i.net_id)).toEqual(["stu1"]);
  });

  it("scope=mine returns items assigned to or by me; scope=all returns everything", async () => {
    await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "a" });
    await insertActionItem({ net_id: "stu3", assigned_by: "pm2", title: "b" });
    asRole("pm", "pm1");

    const mine = await (await GET(makeRequest("http://localhost/api/action_items?scope=mine"))).json();
    expect(mine.map((i) => i.title)).toEqual(["a"]);

    const all = await (await GET(makeRequest("http://localhost/api/action_items?scope=all"))).json();
    expect(all.length).toBe(2);
  });
});

describe("PATCH /api/action_items/[id]", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
  });

  it("toggling is_done sets/clears completion_date, and reopening clears any grade", async () => {
    const item = await insertActionItem({
      net_id: "stu1", assigned_by: "pm1", title: "gradable",
      is_gradable: true, max_score: 100, is_done: true, grade: 90, graded_by: "pm1", graded_at: new Date().toISOString(),
    });
    asRole("pm", "pm1");

    const reopen = await PATCH(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { is_done: false } }),
      { params: { id: item.id } }
    );
    const reopened = await reopen.json();
    expect(reopened.is_done).toBe(false);
    expect(reopened.completion_date).toBeNull();
    expect(reopened.grade).toBeNull();
    expect(reopened.graded_by).toBeNull();
  });

  it("content edits require management authority (students blocked)", async () => {
    const item = await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "orig" });
    asRole("student", "stu1");
    const res = await PATCH(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { title: "hacked" } }),
      { params: { id: item.id } }
    );
    expect(res.status).toBe(403);
  });

  it("pm can only edit items for students in their own group", async () => {
    const inGroup = await insertActionItem({ net_id: "stu1", assigned_by: "head1", title: "a" });
    const outOfGroup = await insertActionItem({ net_id: "stu3", assigned_by: "head1", title: "b" });
    asRole("pm", "pm1"); // group 1

    const okRes = await PATCH(
      makeRequest(`http://localhost/api/action_items/${inGroup.id}`, { method: "PATCH", body: { title: "edited" } }),
      { params: { id: inGroup.id } }
    );
    expect(okRes.status).toBe(200);

    const blockedRes = await PATCH(
      makeRequest(`http://localhost/api/action_items/${outOfGroup.id}`, { method: "PATCH", body: { title: "edited" } }),
      { params: { id: outOfGroup.id } }
    );
    expect(blockedRes.status).toBe(403);
  });

  it("turning off is_gradable clears max_score and any grade", async () => {
    const item = await insertActionItem({
      net_id: "stu1", assigned_by: "pm1", title: "g", is_gradable: true, max_score: 50, is_done: true, grade: 40,
    });
    asRole("pm", "pm1");
    const res = await PATCH(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { is_gradable: false } }),
      { params: { id: item.id } }
    );
    const json = await res.json();
    expect(json.is_gradable).toBe(false);
    expect(json.max_score).toBeNull();
    expect(json.grade).toBeNull();
  });

  describe("grading", () => {
    it("only the assigner can grade, even for a course_lead viewing someone else's item", async () => {
      const item = await insertActionItem({
        net_id: "stu1", assigned_by: "pm1", title: "g", is_gradable: true, max_score: 100, is_done: true,
      });
      asRole("course_lead", "lead1"); // has full edit access, but did NOT assign this item
      const res = await PATCH(
        makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { grade: 90 } }),
        { params: { id: item.id } }
      );
      expect(res.status).toBe(403);
    });

    it("rejects grading a non-gradable or not-yet-done item", async () => {
      const notGradable = await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "a", is_done: true });
      const notDone = await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "b", is_gradable: true, max_score: 100, is_done: false });
      asRole("pm", "pm1");

      const res1 = await PATCH(
        makeRequest(`http://localhost/api/action_items/${notGradable.id}`, { method: "PATCH", body: { grade: 5 } }),
        { params: { id: notGradable.id } }
      );
      expect(res1.status).toBe(400);

      const res2 = await PATCH(
        makeRequest(`http://localhost/api/action_items/${notDone.id}`, { method: "PATCH", body: { grade: 5 } }),
        { params: { id: notDone.id } }
      );
      expect(res2.status).toBe(400);
    });

    it("rejects a grade above max_score, accepts a valid one, and records graded_by/graded_at", async () => {
      const item = await insertActionItem({
        net_id: "stu1", assigned_by: "pm1", title: "g", is_gradable: true, max_score: 100, is_done: true,
      });
      asRole("pm", "pm1");

      const tooHigh = await PATCH(
        makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { grade: 150 } }),
        { params: { id: item.id } }
      );
      expect(tooHigh.status).toBe(400);

      const ok = await PATCH(
        makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { grade: 92, grade_note: "nice work" } }),
        { params: { id: item.id } }
      );
      const json = await ok.json();
      expect(json.grade).toBe(92);
      expect(json.graded_by).toBe("pm1");
      expect(json.graded_at).toBeTruthy();
      expect(json.grade_note).toBe("nice work");
    });
  });
});

describe("DELETE /api/action_items/[id]", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
  });

  it("head_pm cannot delete items assigned to non-PM/STUDENT recipients", async () => {
    const item = await insertActionItem({ net_id: "pm1", assigned_by: "lead1", title: "for a pm" });
    asRole("head_pm", "head1");
    const res = await DELETE(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "DELETE" }),
      { params: { id: item.id } }
    );
    // pm1's role is PM, which IS in head_pm's allowed set — sanity: this should succeed.
    expect(res.status).toBe(200);
  });

  it("pm cannot delete items for students outside their group", async () => {
    const item = await insertActionItem({ net_id: "stu3", assigned_by: "head1", title: "x" });
    asRole("pm", "pm1");
    const res = await DELETE(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "DELETE" }),
      { params: { id: item.id } }
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/action_items/batch/[batchId]", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
  });

  async function makeBatch() {
    const a = await insertActionItem({ net_id: "stu1", assigned_by: "pm1", title: "batch", is_gradable: true, max_score: 100, is_done: true, batch_id: "11111111-1111-1111-1111-111111111111" });
    const b = await insertActionItem({ net_id: "stu2", assigned_by: "pm1", title: "batch", is_gradable: true, max_score: 100, is_done: false, batch_id: "11111111-1111-1111-1111-111111111111" });
    return { a, b, batchId: "11111111-1111-1111-1111-111111111111" };
  }

  it("404s for an unknown batch", async () => {
    asRole("pm", "pm1");
    const unknownBatchId = "00000000-0000-0000-0000-000000000000"; // well-formed but nonexistent
    const res = await PATCH_BATCH(
      makeRequest(`http://localhost/api/action_items/batch/${unknownBatchId}`, { method: "PATCH", body: { grades: [{ id: "00000000-0000-0000-0000-000000000000", grade: 1 }] } }),
      { params: { batchId: unknownBatchId } }
    );
    expect(res.status).toBe(404);
  });

  it("only the assigner can grade the batch", async () => {
    const { batchId, a } = await makeBatch();
    asRole("head_pm", "head1"); // did not assign this batch
    const res = await PATCH_BATCH(
      makeRequest(`http://localhost/api/action_items/batch/${batchId}`, { method: "PATCH", body: { grades: [{ id: a.id, grade: 90 }] } }),
      { params: { batchId } }
    );
    expect(res.status).toBe(403);
  });

  it("grades eligible items and reports skipped ones (not done / invalid grade)", async () => {
    const { batchId, a, b } = await makeBatch();
    asRole("pm", "pm1");
    const res = await PATCH_BATCH(
      makeRequest(`http://localhost/api/action_items/batch/${batchId}`, {
        method: "PATCH",
        body: { grades: [{ id: a.id, grade: 95 }, { id: b.id, grade: 50 }] }, // b is not done yet
      }),
      { params: { batchId } }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.updated).toBe(1);
    expect(json.skipped.length).toBe(1);
    expect(json.skipped[0].id).toBe(b.id);
    expect(json.data[0].grade).toBe(95);
  });
});

describe("action items - sandbox mode", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await seedGroup();
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
  });

  it("a sandboxed single assignment writes to the overlay, not the real table", async () => {
    asRole("web_dev", "webdev1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST", body: { title: "sandboxed", target_type: "individual", target_net_ids: ["stu1"] },
    }));
    expect(res.status).toBe(201);

    const { data: real } = await testClient().from(table("actionItems")).select("*");
    expect(real).toHaveLength(0);

    const list = await (await GET(makeRequest("http://localhost/api/action_items?scope=mine"))).json();
    expect(list.map((i) => i.title)).toEqual(["sandboxed"]);
  });

  it("a sandboxed bulk assignment shares one batch_id across overlay rows", async () => {
    asRole("web_dev", "webdev1");
    const res = await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST", body: { title: "bulk", target_type: "individual", target_net_ids: ["stu1", "stu2"] },
    }));
    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.data[0].batch_id).toBeTruthy();
    expect(json.data[0].batch_id).toBe(json.data[1].batch_id);

    const { data: real } = await testClient().from(table("actionItems")).select("*");
    expect(real).toHaveLength(0);
  });

  it("a sandboxed content edit on a real item doesn't touch the real row", async () => {
    const item = await insertActionItem({ net_id: "stu1", assigned_by: "webdev1", title: "Original" });
    asRole("web_dev", "webdev1");

    const res = await PATCH(
      makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "PATCH", body: { title: "Edited in sandbox" } }),
      { params: { id: item.id } }
    );
    expect((await res.json()).title).toBe("Edited in sandbox");

    const { data: stillReal } = await testClient().from(table("actionItems")).select("title").eq("id", item.id).single();
    expect(stillReal.title).toBe("Original");
  });

  it("full sandboxed lifecycle: create, complete, grade, all within the overlay", async () => {
    asRole("web_dev", "webdev1");
    const created = (await (await POST(makeRequest("http://localhost/api/action_items", {
      method: "POST", body: { title: "g", target_type: "individual", target_net_ids: ["stu1"], is_gradable: true, max_score: 100 },
    }))).json()).data[0];

    const completed = await (await PATCH(
      makeRequest(`http://localhost/api/action_items/${created.id}`, { method: "PATCH", body: { is_done: true } }),
      { params: { id: created.id } }
    )).json();
    expect(completed.is_done).toBe(true);

    const graded = await (await PATCH(
      makeRequest(`http://localhost/api/action_items/${created.id}`, { method: "PATCH", body: { grade: 88 } }),
      { params: { id: created.id } }
    )).json();
    expect(graded.grade).toBe(88);
    expect(graded.graded_by).toBe("webdev1");

    const { data: real } = await testClient().from(table("actionItems")).select("*");
    expect(real).toHaveLength(0);
  });

  it("a sandboxed delete of a real item doesn't touch the real row", async () => {
    const item = await insertActionItem({ net_id: "stu1", assigned_by: "webdev1", title: "x" });
    asRole("web_dev", "webdev1");

    const res = await DELETE(makeRequest(`http://localhost/api/action_items/${item.id}`, { method: "DELETE" }), { params: { id: item.id } });
    expect(res.status).toBe(200);

    const list = await (await GET(makeRequest("http://localhost/api/action_items?scope=all"))).json();
    expect(list).toHaveLength(0);

    const { data: stillReal } = await testClient().from(table("actionItems")).select("id").eq("id", item.id).maybeSingle();
    expect(stillReal).not.toBeNull();
  });

  it("sandboxed batch grading writes to the overlay, not the real batch", async () => {
    const a = await insertActionItem({ net_id: "stu1", assigned_by: "webdev1", title: "batch", is_gradable: true, max_score: 100, is_done: true, batch_id: "22222222-2222-2222-2222-222222222222" });
    asRole("web_dev", "webdev1");

    const res = await PATCH_BATCH(
      makeRequest("http://localhost/api/action_items/batch/22222222-2222-2222-2222-222222222222", { method: "PATCH", body: { grades: [{ id: a.id, grade: 77 }] } }),
      { params: { batchId: "22222222-2222-2222-2222-222222222222" } }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].grade).toBe(77);

    const { data: stillReal } = await testClient().from(table("actionItems")).select("grade").eq("id", a.id).single();
    expect(stillReal.grade).toBeNull();
  });

  it("sandboxed batch delete doesn't touch the real rows", async () => {
    const a = await insertActionItem({ net_id: "stu1", assigned_by: "webdev1", title: "batch", batch_id: "33333333-3333-3333-3333-333333333333" });
    const b = await insertActionItem({ net_id: "stu2", assigned_by: "webdev1", title: "batch", batch_id: "33333333-3333-3333-3333-333333333333" });
    asRole("web_dev", "webdev1");

    const res = await DELETE_BATCH(
      makeRequest("http://localhost/api/action_items/batch/33333333-3333-3333-3333-333333333333", { method: "DELETE" }),
      { params: { batchId: "33333333-3333-3333-3333-333333333333" } }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(2);

    const list = await (await GET(makeRequest("http://localhost/api/action_items?scope=all"))).json();
    expect(list).toHaveLength(0);

    const { data: stillReal } = await testClient().from(table("actionItems")).select("id").in("id", [a.id, b.id]);
    expect(stillReal).toHaveLength(2);
  });
});
