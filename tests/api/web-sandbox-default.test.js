import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { POST } = await import("../../app/api/users/route");
const { PATCH } = await import("../../app/api/users/[net_id]/route");
const { POST: IMPORT } = await import("../../app/api/users/import/route");

const modeOf = async (netID) => (await testClient().from(table("users")).select("sandbox_mode").eq("net_id", netID).single()).data.sandbox_mode;

afterAll(clearAllTestTables);

describe("web devs start in ephemeral sandbox mode", () => {
  beforeEach(async () => {
    await clearAllTestTables();
    await insertUser({ net_id: "lead1", role: "LEAD" });
    asRole("course_lead", "lead1");
  });

  it("when added, while other roles keep the database default", async () => {
    expect((await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "newweb", role: "WEB" } }))).status).toBe(201);
    expect((await POST(makeRequest("http://localhost/api/users", { method: "POST", body: { net_id: "newstu", role: "STUDENT" } }))).status).toBe(201);
    expect(await modeOf("newweb")).toBe("ephemeral");
    expect(await modeOf("newstu")).toBe("off");
  });

  it("when promoted onto the web team, but a web dev's own choice survives a role change within it", async () => {
    await insertUser({ net_id: "promoted", role: "STUDENT", sandbox_mode: "off" });
    await insertUser({ net_id: "veteran", role: "WEB", sandbox_mode: "off" });
    const patch = (netID, body) => PATCH(makeRequest(`http://localhost/api/users/${netID}`, { method: "PATCH", body }), { params: Promise.resolve({ net_id: netID }) });
    expect((await patch("promoted", { role: "WEB" })).status).toBe(200);
    expect((await patch("veteran", { role: "LEAD_WEB" })).status).toBe(200);
    expect(await modeOf("promoted")).toBe("ephemeral");
    expect(await modeOf("veteran")).toBe("off");
  });

  it("when imported", async () => {
    const res = await IMPORT(makeRequest("http://localhost/api/users/import", {
      method: "POST", body: { mode: "append", rows: [{ net_id: "importweb", role: "WEB" }, { net_id: "importstu", role: "STUDENT", group_number: "2" }] },
    }));
    expect(res.status).toBe(200);
    expect(await modeOf("importweb")).toBe("ephemeral");
    expect(await modeOf("importstu")).toBe("off");
  });
});
