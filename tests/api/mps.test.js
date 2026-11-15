import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const { GET, POST } = await import("../../app/api/mps/route");
const { PATCH, DELETE } = await import("../../app/api/mps/[id]/route");

afterAll(clearAllTestTables);

const create = (body) => POST(makeRequest("http://localhost/api/mps", { method: "POST", body }));
const NEURALNET = { name: "NeuralNet", release_at: "2026-11-09T06:00:00Z", due_at: "2026-11-23T05:59:59Z", prairielearn_url: "https://us.prairielearn.com/pl/course_instance/1/assessment/2" };

describe("MPs API", () => {
  beforeEach(clearAllTestTables);

  it("only course leads and head PMs can list, add, edit, or remove MPs", async () => {
    for (const role of ["student", "pm", "lead_web_dev"]) {
      asRole(role, `${role}1`);
      expect((await GET()).status).toBe(403);
      expect((await create(NEURALNET)).status).toBe(403);
    }
    for (const role of ["course_lead", "head_pm"]) {
      asRole(role, `${role}1`);
      expect((await create({ ...NEURALNET, name: `MP by ${role}` })).status).toBe(201);
    }
    asRole("course_lead", "lead1");
    expect((await (await GET()).json()).map((m) => m.name).sort()).toEqual(["MP by course_lead", "MP by head_pm"]);
  });

  it("rejects a missing name or due date, an MP that opens after it's due, and a non-https link", async () => {
    asRole("course_lead", "lead1");
    expect((await create({ ...NEURALNET, name: " " })).status).toBe(400);
    expect((await create({ ...NEURALNET, due_at: "not a date" })).status).toBe(400);
    expect((await create({ ...NEURALNET, release_at: "2026-11-24T00:00:00Z" })).status).toBe(400);
    expect((await create({ ...NEURALNET, prairielearn_url: "javascript:alert(1)" })).status).toBe(400);
    expect((await create({ ...NEURALNET, prairielearn_url: "http://example.com" })).status).toBe(400);
    const { data } = await testClient().from(table("mps")).select("id");
    expect(data).toEqual([]);
  });

  it("edits dates against the stored ones and removes an MP", async () => {
    asRole("course_lead", "lead1");
    const mp = await (await create(NEURALNET)).json();
    const params = { params: { id: mp.id } };
    const later = await PATCH(makeRequest(`http://localhost/api/mps/${mp.id}`, { method: "PATCH", body: { due_at: "2026-11-30T05:59:59Z" } }), params);
    expect(later.status).toBe(200);
    expect((await later.json()).due_at).toMatch(/^2026-11-30T05:59:59/);
    // Moving the due date before the stored open date is refused.
    const tooEarly = await PATCH(makeRequest(`http://localhost/api/mps/${mp.id}`, { method: "PATCH", body: { due_at: "2026-11-01T00:00:00Z" } }), params);
    expect(tooEarly.status).toBe(400);
    expect((await DELETE(makeRequest(`http://localhost/api/mps/${mp.id}`, { method: "DELETE" }), params)).status).toBe(200);
    expect((await DELETE(makeRequest(`http://localhost/api/mps/${mp.id}`, { method: "DELETE" }), params)).status).toBe(404);
  });
});
