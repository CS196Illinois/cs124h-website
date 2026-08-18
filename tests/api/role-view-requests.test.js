import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertRoleViewRequest, clearAllTestTables } from "../helpers/db";

const { GET, POST } = await import("../../app/api/role-view-requests/route");
const { PATCH, DELETE } = await import("../../app/api/role-view-requests/[id]/route");

afterAll(clearAllTestTables);

describe("POST /api/role-view-requests", () => {
  beforeEach(clearAllTestTables);

  it("only web_devs can request access", async () => {
    asRole("pm", "pm1");
    const res = await POST(makeRequest("http://localhost/api/role-view-requests", {
      method: "POST",
      body: { requested_role: "student" },
    }));
    expect(res.status).toBe(403);
  });

  it("rejects a role that isn't requestable", async () => {
    asRole("web_dev", "web1");
    const res = await POST(makeRequest("http://localhost/api/role-view-requests", {
      method: "POST",
      body: { requested_role: "web_dev" },
    }));
    expect(res.status).toBe(400);
  });

  it("creates a pending request, and blocks a duplicate while one is pending", async () => {
    asRole("web_dev", "web1");
    const first = await POST(makeRequest("http://localhost/api/role-view-requests", {
      method: "POST",
      body: { requested_role: "student" },
    }));
    expect(first.status).toBe(201);
    expect((await first.json()).status).toBe("pending");

    const dup = await POST(makeRequest("http://localhost/api/role-view-requests", {
      method: "POST",
      body: { requested_role: "student" },
    }));
    expect(dup.status).toBe(409);
  });

  it("allows re-requesting after a prior approval expired", async () => {
    await insertRoleViewRequest({
      requester_net_id: "web1",
      requested_role: "student",
      status: "approved",
      expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    });
    asRole("web_dev", "web1");
    const res = await POST(makeRequest("http://localhost/api/role-view-requests", {
      method: "POST",
      body: { requested_role: "student" },
    }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/role-view-requests", () => {
  beforeEach(clearAllTestTables);

  it("only lead_web_dev and web_dev can list requests", async () => {
    asRole("pm", "pm1");
    const res = await GET(makeRequest("http://localhost/api/role-view-requests"));
    expect(res.status).toBe(403);
  });

  it("web_dev only sees their own requests; lead_web_dev sees everyone's", async () => {
    await insertRoleViewRequest({ requester_net_id: "web1", requested_role: "student" });
    await insertRoleViewRequest({ requester_net_id: "web2", requested_role: "pm" });

    asRole("web_dev", "web1");
    const own = await (await GET(makeRequest("http://localhost/api/role-view-requests"))).json();
    expect(own.map((r) => r.requester_net_id)).toEqual(["web1"]);

    asRole("lead_web_dev", "leadweb1");
    const all = await (await GET(makeRequest("http://localhost/api/role-view-requests"))).json();
    expect(all.length).toBe(2);
  });

  it("lazily purges expired approved rows on read", async () => {
    await insertRoleViewRequest({
      requester_net_id: "web1", requested_role: "student", status: "approved",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    asRole("lead_web_dev", "leadweb1");
    const res = await (await GET(makeRequest("http://localhost/api/role-view-requests"))).json();
    expect(res.length).toBe(0);
  });
});

describe("PATCH /api/role-view-requests/[id] (approve/deny)", () => {
  beforeEach(clearAllTestTables);

  it("only lead_web_dev can review", async () => {
    const req = await insertRoleViewRequest({ requester_net_id: "web1", requested_role: "student" });
    asRole("web_dev", "web1");
    const res = await PATCH(
      makeRequest(`http://localhost/api/role-view-requests/${req.id}`, { method: "PATCH", body: { status: "approved" } }),
      { params: { id: req.id } }
    );
    expect(res.status).toBe(403);
  });

  it("approving sets an expiry based on duration_days; null means permanent", async () => {
    const req = await insertRoleViewRequest({ requester_net_id: "web1", requested_role: "student" });
    asRole("lead_web_dev", "leadweb1");

    const res = await PATCH(
      makeRequest(`http://localhost/api/role-view-requests/${req.id}`, { method: "PATCH", body: { status: "approved", duration_days: 3 } }),
      { params: { id: req.id } }
    );
    const json = await res.json();
    expect(json.status).toBe("approved");
    expect(json.reviewed_by).toBe("leadweb1");
    expect(new Date(json.expires_at).getTime()).toBeGreaterThan(Date.now());

    const req2 = await insertRoleViewRequest({ requester_net_id: "web2", requested_role: "pm" });
    const permRes = await PATCH(
      makeRequest(`http://localhost/api/role-view-requests/${req2.id}`, { method: "PATCH", body: { status: "approved", duration_days: null } }),
      { params: { id: req2.id } }
    );
    expect((await permRes.json()).expires_at).toBeNull();
  });

  it("404s when reviewing an already-reviewed request", async () => {
    const req = await insertRoleViewRequest({ requester_net_id: "web1", requested_role: "student", status: "denied" });
    asRole("lead_web_dev", "leadweb1");
    const res = await PATCH(
      makeRequest(`http://localhost/api/role-view-requests/${req.id}`, { method: "PATCH", body: { status: "approved" } }),
      { params: { id: req.id } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/role-view-requests/[id] (revoke)", () => {
  beforeEach(clearAllTestTables);

  it("only lead_web_dev can revoke, and only approved rows are affected", async () => {
    const req = await insertRoleViewRequest({ requester_net_id: "web1", requested_role: "student", status: "approved" });
    asRole("web_dev", "web1");
    const forbidden = await DELETE(makeRequest(`http://localhost/api/role-view-requests/${req.id}`, { method: "DELETE" }), { params: { id: req.id } });
    expect(forbidden.status).toBe(403);

    asRole("lead_web_dev", "leadweb1");
    const ok = await DELETE(makeRequest(`http://localhost/api/role-view-requests/${req.id}`, { method: "DELETE" }), { params: { id: req.id } });
    expect(ok.status).toBe(200);
  });
});
