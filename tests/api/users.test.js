import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole, asAnonymous } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSandboxOverlay, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET, POST, DELETE } = await import("../../app/api/users/route");
const { PATCH: PATCH_ONE, DELETE: DELETE_ONE } = await import("../../app/api/users/[net_id]/route");
const { GET: GET_ROLES } = await import("../../app/api/roles/route");
const { GET: GET_ME } = await import("../../app/api/users/me/route");

afterAll(clearAllTestTables);

describe("GET /api/users", () => {
  beforeEach(clearAllTestTables);

  it("401s with no session", async () => {
    asAnonymous();
    const res = await GET(makeRequest("http://localhost/api/users"));
    expect(res.status).toBe(401);
  });

  it("lists users, filterable by role and group", async () => {
    await insertUser({ net_id: "u1", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "u2", role: "STUDENT", group_number: 2 });
    await insertUser({ net_id: "u3", role: "PM", group_number: 1 });
    asRole("course_lead", "lead1");

    const all = await (await GET(makeRequest("http://localhost/api/users"))).json();
    expect(all.length).toBe(3);

    const students = await (await GET(makeRequest("http://localhost/api/users?role=STUDENT"))).json();
    expect(students.map((u) => u.net_id).sort()).toEqual(["u1", "u2"]);

    const group1 = await (await GET(makeRequest("http://localhost/api/users?group=1"))).json();
    expect(group1.map((u) => u.net_id).sort()).toEqual(["u1", "u3"]);
  });
});

describe("POST /api/users", () => {
  beforeEach(clearAllTestTables);

  it("rejects roles the caller isn't allowed to manage", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/users", {
      method: "POST",
      body: { net_id: "newpm", role: "PM" },
    }));
    expect(res.status).toBe(403);
  });

  it("lets a pm create a student in their scope", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/users", {
      method: "POST",
      body: { net_id: "NewStu2", role: "STUDENT", group_number: 4 },
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.net_id).toBe("newstu2"); // lowercased
  });

  it("400s when net_id or role is missing", async () => {
    asRole("course_lead", "lead1");
    const res = await POST(makeRequest("http://localhost/api/users", {
      method: "POST",
      body: { role: "STUDENT" },
    }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/users (bulk by role)", () => {
  beforeEach(clearAllTestTables);

  it("blocks roles without bulk-delete permission", async () => {
    asRole("pm", "pm1");
    const res = await DELETE(makeRequest("http://localhost/api/users?role=STUDENT", { method: "DELETE" }));
    expect(res.status).toBe(403);
  });

  it("deletes every user with the given role", async () => {
    await insertUser({ net_id: "s1", role: "STUDENT" });
    await insertUser({ net_id: "s2", role: "STUDENT" });
    await insertUser({ net_id: "p1", role: "PM" });
    asRole("course_lead", "lead1");

    const res = await DELETE(makeRequest("http://localhost/api/users?role=STUDENT", { method: "DELETE" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(2);

    const remaining = await (await GET(makeRequest("http://localhost/api/users"))).json();
    expect(remaining.map((u) => u.net_id)).toEqual(["p1"]);
  });
});

describe("PATCH /api/users/[net_id]", () => {
  beforeEach(clearAllTestTables);

  it("401s for students", async () => {
    asRole("student", "stu1");
    const res = await PATCH_ONE(
      makeRequest("http://localhost/api/users/stu1", { method: "PATCH", body: { name: "x" } }),
      { params: { net_id: "stu1" } }
    );
    expect(res.status).toBe(401);
  });

  it("head_pm can edit a PM's group but not their role", async () => {
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
    asRole("head_pm", "head1");

    const groupRes = await PATCH_ONE(
      makeRequest("http://localhost/api/users/pm1", { method: "PATCH", body: { group_number: 5 } }),
      { params: { net_id: "pm1" } }
    );
    expect(groupRes.status).toBe(200);
    expect((await groupRes.json()).group_number).toBe(5);

    const roleRes = await PATCH_ONE(
      makeRequest("http://localhost/api/users/pm1", { method: "PATCH", body: { role: "HEAD" } }),
      { params: { net_id: "pm1" } }
    );
    expect(roleRes.status).toBe(403);
  });

  it("head_pm cannot edit users outside PM/STUDENT", async () => {
    await insertUser({ net_id: "web1", role: "WEB" });
    asRole("head_pm", "head1");
    const res = await PATCH_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "PATCH", body: { name: "x" } }),
      { params: { net_id: "web1" } }
    );
    expect(res.status).toBe(403);
  });

  it("lead_web_dev can only assign WEB/LEAD_WEB roles", async () => {
    await insertUser({ net_id: "web1", role: "WEB" });
    asRole("lead_web_dev", "leadweb1");
    const badRes = await PATCH_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "PATCH", body: { role: "STUDENT" } }),
      { params: { net_id: "web1" } }
    );
    expect(badRes.status).toBe(403);

    const okRes = await PATCH_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "PATCH", body: { role: "LEAD_WEB" } }),
      { params: { net_id: "web1" } }
    );
    expect(okRes.status).toBe(200);
  });
});

describe("DELETE /api/users/[net_id]", () => {
  beforeEach(clearAllTestTables);

  it("pms cannot delete users", async () => {
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    asRole("pm", "pm1");
    const res = await DELETE_ONE(
      makeRequest("http://localhost/api/users/stu1", { method: "DELETE" }),
      { params: { net_id: "stu1" } }
    );
    expect(res.status).toBe(403);
  });

  it("head_pm can delete a student but not a web dev", async () => {
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    await insertUser({ net_id: "web1", role: "WEB" });
    asRole("head_pm", "head1");

    const studentRes = await DELETE_ONE(
      makeRequest("http://localhost/api/users/stu1", { method: "DELETE" }),
      { params: { net_id: "stu1" } }
    );
    expect(studentRes.status).toBe(200);

    const webRes = await DELETE_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "DELETE" }),
      { params: { net_id: "web1" } }
    );
    expect(webRes.status).toBe(403);
  });
});

describe("sandbox cleanup on role revocation / user removal", () => {
  beforeEach(clearAllTestTables);

  it("demoting a web_dev away from the web team clears their sandbox overlay", async () => {
    await insertUser({ net_id: "web1", role: "WEB", sandbox_mode: "persistent" });
    await insertSandboxOverlay({ owner_net_id: "web1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("course_lead", "lead1");

    const res = await PATCH_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "PATCH", body: { role: "STUDENT" } }),
      { params: { net_id: "web1" } }
    );
    expect(res.status).toBe(200);

    const { data } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "web1");
    expect(data).toHaveLength(0);
  });

  it("moving between WEB and LEAD_WEB (staying on the web team) does not clear the sandbox", async () => {
    await insertUser({ net_id: "web1", role: "WEB", sandbox_mode: "persistent" });
    await insertSandboxOverlay({ owner_net_id: "web1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("lead_web_dev", "leadweb1");

    await PATCH_ONE(
      makeRequest("http://localhost/api/users/web1", { method: "PATCH", body: { role: "LEAD_WEB" } }),
      { params: { net_id: "web1" } }
    );

    const { data } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "web1");
    expect(data).toHaveLength(1);
  });

  it("deleting a web_dev user clears their sandbox overlay", async () => {
    await insertUser({ net_id: "web1", role: "WEB" });
    await insertSandboxOverlay({ owner_net_id: "web1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("course_lead", "lead1");

    const res = await DELETE_ONE(makeRequest("http://localhost/api/users/web1", { method: "DELETE" }), { params: { net_id: "web1" } });
    expect(res.status).toBe(200);

    const { data } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "web1");
    expect(data).toHaveLength(0);
  });

  it("bulk-deleting all WEB users clears all of their sandbox overlays", async () => {
    await insertUser({ net_id: "web1", role: "WEB" });
    await insertUser({ net_id: "web2", role: "WEB" });
    await insertSandboxOverlay({ owner_net_id: "web1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    await insertSandboxOverlay({ owner_net_id: "web2", table_key: "sprints", row_pk: "s2", op: "insert", row_data: { id: "s2" } });
    asRole("course_lead", "lead1");

    const res = await DELETE(makeRequest("http://localhost/api/users?role=WEB", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(2);

    const { data } = await testClient().from(table("sandboxOverlay")).select("*").in("owner_net_id", ["web1", "web2"]);
    expect(data).toHaveLength(0);
  });
});

describe("users table - sandbox mode", () => {
  beforeEach(clearAllTestTables);

  it("a sandboxed create writes to the overlay, not the real table, and shows up in the sandboxed list", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    asRole("web_dev", "webdev1");

    const res = await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "jdoe2", role: "WEB", name: "John Doe", group_number: 69 } }));
    expect(res.status).toBe(201);

    const { data: real } = await testClient().from(table("users")).select("*").eq("net_id", "jdoe2");
    expect(real).toHaveLength(0);

    const list = await (await GET(makeRequest("http://localhost/api/users"))).json();
    expect(list.map((u) => u.net_id)).toContain("jdoe2");
  });

  it("creating a net_id that already exists (real or sandboxed) fails, same as a real PK collision would", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "existing1", role: "STUDENT" });
    asRole("web_dev", "webdev1");

    const res = await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "existing1", role: "PM" } }));
    expect(res.status).toBe(500);
  });

  it("a sandboxed edit to a real user doesn't touch the real row", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "target1", role: "STUDENT", group_number: 1 });
    asRole("web_dev", "webdev1");

    const res = await PATCH_ONE(
      makeRequest("http://localhost/api/users/target1", { method: "PATCH", body: { group_number: 99 } }),
      { params: { net_id: "target1" } }
    );
    expect((await res.json()).group_number).toBe(99);

    const { data: stillReal } = await testClient().from(table("users")).select("group_number").eq("net_id", "target1").single();
    expect(stillReal.group_number).toBe(1);
  });

  it("a sandboxed delete of a real user doesn't touch the real row", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "target1", role: "STUDENT" });
    asRole("web_dev", "webdev1");

    const res = await DELETE_ONE(makeRequest("http://localhost/api/users/target1", { method: "DELETE" }), { params: { net_id: "target1" } });
    expect(res.status).toBe(200);

    const list = await (await GET(makeRequest("http://localhost/api/users"))).json();
    expect(list.map((u) => u.net_id)).not.toContain("target1");

    const { data: stillReal } = await testClient().from(table("users")).select("net_id").eq("net_id", "target1").maybeSingle();
    expect(stillReal).not.toBeNull();
  });

  it("a sandboxed edit does NOT trigger the real revoke-cleanup side effect on the target's own sandbox", async () => {
    // target1 is itself a real web_dev with its own real, populated sandbox.
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertUser({ net_id: "target1", role: "WEB", sandbox_mode: "persistent" });
    await insertSandboxOverlay({ owner_net_id: "target1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("web_dev", "webdev1");

    // webdev1, sandboxed, demotes target1 to STUDENT - but only in webdev1's own sandbox.
    await PATCH_ONE(
      makeRequest("http://localhost/api/users/target1", { method: "PATCH", body: { role: "STUDENT" } }),
      { params: { net_id: "target1" } }
    );

    // target1's own real sandbox must be untouched - this was a fake edit.
    const { data: target1Overlay } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "target1");
    expect(target1Overlay).toHaveLength(1);
    const { data: target1Row } = await testClient().from(table("users")).select("role, sandbox_mode").eq("net_id", "target1").single();
    expect(target1Row.role).toBe("WEB");
    expect(target1Row.sandbox_mode).toBe("persistent");
  });

  it("a sandboxed lead_web_dev can manage a sandbox-only fake web dev they created", async () => {
    await insertUser({ net_id: "leadweb1", role: "LEAD_WEB", sandbox_mode: "persistent" });
    asRole("lead_web_dev", "leadweb1");

    await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "fakeweb1", role: "WEB" } }));

    const res = await PATCH_ONE(
      makeRequest("http://localhost/api/users/fakeweb1", { method: "PATCH", body: { role: "LEAD_WEB" } }),
      { params: { net_id: "fakeweb1" } }
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/users/me reflects a sandboxed self-edit", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent", name: "Real Name" });
    asRole("web_dev", "webdev1");

    await PATCH_ONE(
      makeRequest("http://localhost/api/users/webdev1", { method: "PATCH", body: { name: "Sandboxed Name" } }),
      { params: { net_id: "webdev1" } }
    );

    const me = await (await GET_ME()).json();
    expect(me.name).toBe("Sandboxed Name");

    const { data: stillReal } = await testClient().from(table("users")).select("name").eq("net_id", "webdev1").single();
    expect(stillReal.name).toBe("Real Name");
  });

  it("action items can target a sandbox-only fake person", async () => {
    await insertUser({ net_id: "leadweb1", role: "LEAD_WEB", sandbox_mode: "persistent" });
    asRole("lead_web_dev", "leadweb1");

    await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "fakeweb1", role: "WEB", group_number: 7 } }));

    const { POST: POST_ACTION_ITEM } = await import("../../app/api/action_items/route");
    const res = await POST_ACTION_ITEM(makeRequest("http://localhost/api/action_items", {
      method: "POST",
      body: { title: "test item", target_type: "individual", target_net_ids: ["fakeweb1"] },
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data[0].net_id).toBe("fakeweb1");

    const { data: realItems } = await testClient().from(table("actionItems")).select("*");
    expect(realItems).toHaveLength(0);
  });
});

describe("GET /api/roles", () => {
  it("returns every role by default, and only manageable roles when scoped", async () => {
    asRole("pm", "pm1");
    const all = await (await GET_ROLES(makeRequest("http://localhost/api/roles"))).json();
    expect(all.map((r) => r.id)).toContain("LEAD");

    const manageable = await (await GET_ROLES(makeRequest("http://localhost/api/roles?manageable=true"))).json();
    expect(manageable.map((r) => r.id)).toEqual(["STUDENT"]);
  });
});
