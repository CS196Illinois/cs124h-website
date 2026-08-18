import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole, asAnonymous } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, clearAllTestTables } from "../helpers/db";

const { GET, POST, DELETE } = await import("../../app/api/users/route");
const { PATCH: PATCH_ONE, DELETE: DELETE_ONE } = await import("../../app/api/users/[net_id]/route");
const { GET: GET_ROLES } = await import("../../app/api/roles/route");

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

describe("GET /api/roles", () => {
  it("returns every role by default, and only manageable roles when scoped", async () => {
    asRole("pm", "pm1");
    const all = await (await GET_ROLES(makeRequest("http://localhost/api/roles"))).json();
    expect(all.map((r) => r.id)).toContain("LEAD");

    const manageable = await (await GET_ROLES(makeRequest("http://localhost/api/roles?manageable=true"))).json();
    expect(manageable.map((r) => r.id)).toEqual(["STUDENT"]);
  });
});
