import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole, asAnonymous } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertEvent, clearAllTestTables } from "../helpers/db";

const { GET, POST } = await import("../../app/api/events/route");
const { PATCH, DELETE } = await import("../../app/api/events/[id]/route");
const { GET: GET_CHECKIN, POST: POST_CHECKIN } = await import("../../app/api/events/[id]/checkin/route");
const { GET: GET_CODE, deriveCode } = await import("../../app/api/events/[id]/code/route");
const { GET: GET_MY_CHECKINS } = await import("../../app/api/events/my-checkins/route");

afterAll(clearAllTestTables);

describe("GET/POST /api/events", () => {
  beforeEach(clearAllTestTables);

  it("401s with no session", async () => {
    asAnonymous();
    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(401);
  });

  it("only staff roles can create events; students are blocked", async () => {
    asRole("student", "stu1");
    const res = await POST(makeRequest("http://localhost/api/events", { method: "POST", body: { title: "x" } }));
    expect(res.status).toBe(403);
  });

  it("creates an event, defaulting end_time to start_time + 1h", async () => {
    asRole("pm", "pm1");
    const start = new Date("2026-01-01T18:00:00Z").toISOString();
    const res = await POST(makeRequest("http://localhost/api/events", {
      method: "POST", body: { title: "Workshop", start_time: start },
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(new Date(json.end_time).getTime() - new Date(start).getTime()).toBe(60 * 60 * 1000);
    expect(json.created_by).toBe("pm1");
  });
});

describe("PATCH/DELETE /api/events/[id]", () => {
  beforeEach(clearAllTestTables);

  it("a non-full-access staffer can only edit events they created", async () => {
    const mine = await insertEvent({ title: "mine", created_by: "pm1" });
    const others = await insertEvent({ title: "theirs", created_by: "pm2" });
    asRole("pm", "pm1");

    const ok = await PATCH(
      makeRequest(`http://localhost/api/events/${mine.id}`, { method: "PATCH", body: { title: "renamed" } }),
      { params: { id: mine.id } }
    );
    expect((await ok.json()).title).toBe("renamed");

    const blocked = await PATCH(
      makeRequest(`http://localhost/api/events/${others.id}`, { method: "PATCH", body: { title: "hacked" } }),
      { params: { id: others.id } }
    );
    // update matches zero rows (scoped to created_by=pm1) -> .single() errors
    expect(blocked.status).toBe(500);
  });

  it("course_lead (full access) can edit and delete any event", async () => {
    const event = await insertEvent({ title: "theirs", created_by: "pm2" });
    asRole("course_lead", "lead1");

    const res = await PATCH(
      makeRequest(`http://localhost/api/events/${event.id}`, { method: "PATCH", body: { check_in_open: true } }),
      { params: { id: event.id } }
    );
    const json = await res.json();
    expect(json.check_in_open).toBe(true);
    expect(json.check_in_opened_at).toBeTruthy();

    const del = await DELETE(makeRequest(`http://localhost/api/events/${event.id}`, { method: "DELETE" }), { params: { id: event.id } });
    expect(del.status).toBe(200);
  });
});

describe("attendance code + check-in", () => {
  beforeEach(clearAllTestTables);

  it("code endpoint is staff-only and requires check-in to be open", async () => {
    const event = await insertEvent({ title: "e", check_in_open: false });
    asRole("student", "stu1");
    const forbidden = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    expect(forbidden.status).toBe(403);

    asRole("pm", "pm1");
    const notOpen = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    expect(notOpen.status).toBe(400);
  });

  it("returns a code matching deriveCode() once check-in is open", async () => {
    const event = await insertEvent({ title: "e", check_in_open: true });
    asRole("pm", "pm1");
    const res = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    const json = await res.json();
    expect(json.code).toBe(deriveCode(event.id));
    expect(json.expiresIn).toBeGreaterThan(0);
  });

  it("rejects an incorrect check-in code and a check-in when the window is closed", async () => {
    const open = await insertEvent({ title: "open", check_in_open: true });
    const closed = await insertEvent({ title: "closed", check_in_open: false });
    asRole("student", "stu1");

    const wrongCode = await POST_CHECKIN(
      makeRequest(`http://localhost/api/events/${open.id}/checkin`, { method: "POST", body: { code: "000000" } }),
      { params: { id: open.id } }
    );
    expect(wrongCode.status).toBe(400);

    const notOpen = await POST_CHECKIN(
      makeRequest(`http://localhost/api/events/${closed.id}/checkin`, { method: "POST", body: { code: deriveCode(closed.id) } }),
      { params: { id: closed.id } }
    );
    expect(notOpen.status).toBe(400);
  });

  it("accepts the correct code, records the check-in, and blocks a duplicate", async () => {
    const event = await insertEvent({ title: "open", check_in_open: true });
    asRole("student", "stu1");

    const first = await POST_CHECKIN(
      makeRequest(`http://localhost/api/events/${event.id}/checkin`, { method: "POST", body: { code: deriveCode(event.id) } }),
      { params: { id: event.id } }
    );
    expect(first.status).toBe(201);

    const dup = await POST_CHECKIN(
      makeRequest(`http://localhost/api/events/${event.id}/checkin`, { method: "POST", body: { code: deriveCode(event.id) } }),
      { params: { id: event.id } }
    );
    expect(dup.status).toBe(409);

    asRole("pm", "pm1"); // staff role, to read the attendee list
    const attendees = await (await GET_CHECKIN(makeRequest(`http://localhost/api/events/${event.id}/checkin`), { params: { id: event.id } })).json();
    expect(attendees.map((a) => a.net_id)).toEqual(["stu1"]);

    asRole("student", "stu1");
    const mine = await (await GET_MY_CHECKINS(makeRequest("http://localhost/api/events/my-checkins"))).json();
    expect(mine.map((c) => c.event_id)).toEqual([event.id]);
  });
});
