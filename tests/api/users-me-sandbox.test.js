import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole, asAnonymous } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertSandboxOverlay, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET, PATCH, DELETE } = await import("../../app/api/users/me/sandbox/route");

afterAll(clearAllTestTables);

describe("GET /api/users/me/sandbox", () => {
  beforeEach(clearAllTestTables);

  it("401s with no session", async () => {
    asAnonymous();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403s for a non-sandbox role", async () => {
    await insertUser({ net_id: "pm1", role: "PM" });
    asRole("pm", "pm1");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the current mode for a web_dev, defaulting to off", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB" });
    asRole("web_dev", "webdev1");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "off" });
  });

  it("works for lead_web_dev too", async () => {
    await insertUser({ net_id: "leadweb1", role: "LEAD_WEB" });
    asRole("lead_web_dev", "leadweb1");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/users/me/sandbox", () => {
  beforeEach(clearAllTestTables);

  it("401s with no session", async () => {
    asAnonymous();
    const res = await PATCH(makeRequest("http://localhost/api/users/me/sandbox", { method: "PATCH", body: { mode: "ephemeral" } }));
    expect(res.status).toBe(401);
  });

  it("403s for a non-sandbox role", async () => {
    await insertUser({ net_id: "pm1", role: "PM" });
    asRole("pm", "pm1");
    const res = await PATCH(makeRequest("http://localhost/api/users/me/sandbox", { method: "PATCH", body: { mode: "ephemeral" } }));
    expect(res.status).toBe(403);
  });

  it("400s on an invalid mode", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB" });
    asRole("web_dev", "webdev1");
    const res = await PATCH(makeRequest("http://localhost/api/users/me/sandbox", { method: "PATCH", body: { mode: "sorta" } }));
    expect(res.status).toBe(400);
  });

  it("sets and persists the mode", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB" });
    asRole("web_dev", "webdev1");

    const res = await PATCH(makeRequest("http://localhost/api/users/me/sandbox", { method: "PATCH", body: { mode: "persistent" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "persistent" });

    const { data } = await testClient().from(table("users")).select("sandbox_mode").eq("net_id", "webdev1").single();
    expect(data.sandbox_mode).toBe("persistent");
  });

  it("only ever changes the caller's own row, never another user's", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB" });
    await insertUser({ net_id: "webdev2", role: "WEB" });
    asRole("web_dev", "webdev1");

    await PATCH(makeRequest("http://localhost/api/users/me/sandbox", { method: "PATCH", body: { mode: "ephemeral" } }));

    const { data: other } = await testClient().from(table("users")).select("sandbox_mode").eq("net_id", "webdev2").single();
    expect(other.sandbox_mode).toBe("off");
  });
});

describe("DELETE /api/users/me/sandbox", () => {
  beforeEach(clearAllTestTables);

  it("401s with no session", async () => {
    asAnonymous();
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("403s for a non-sandbox role", async () => {
    await insertUser({ net_id: "pm1", role: "PM" });
    asRole("pm", "pm1");
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("clears the caller's overlay rows without touching mode", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB", sandbox_mode: "persistent" });
    await insertSandboxOverlay({ owner_net_id: "webdev1", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("web_dev", "webdev1");

    const res = await DELETE();
    expect(res.status).toBe(200);

    const { data: overlay } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "webdev1");
    expect(overlay).toHaveLength(0);

    const { data: user } = await testClient().from(table("users")).select("sandbox_mode").eq("net_id", "webdev1").single();
    expect(user.sandbox_mode).toBe("persistent");
  });

  it("only ever clears the caller's own overlay, never another user's", async () => {
    await insertUser({ net_id: "webdev1", role: "WEB" });
    await insertSandboxOverlay({ owner_net_id: "webdev2", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    asRole("web_dev", "webdev1");

    await DELETE();

    const { data: other } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "webdev2");
    expect(other).toHaveLength(1);
  });
});
