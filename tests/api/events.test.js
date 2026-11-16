import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { asRole, asAnonymous } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { insertUser, insertEvent, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";
import { recentCodes } from "../helpers/checkinCode";

const { GET, POST } = await import("../../app/api/events/route");
const { PATCH, DELETE } = await import("../../app/api/events/[id]/route");
const { GET: GET_CHECKIN, POST: POST_CHECKIN } = await import("../../app/api/events/[id]/checkin/route");
const { GET: GET_CODE, deriveCode } = await import("../../app/api/events/[id]/code/route");
const { GET: GET_MY_CHECKINS } = await import("../../app/api/events/my-checkins/route");
const { POST: POST_MANUAL, DELETE: DELETE_MANUAL } = await import("../../app/api/events/[id]/checkin/manual/route");
const { CHECK_IN_GRACE_MS } = await import("../../lib/events");

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
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
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

  it("only the event creator can edit or delete it, regardless of staff role", async () => {
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
    expect(blocked.status).toBe(403);

    asRole("head_pm", "head1");
    const headBlocked = await PATCH(
      makeRequest(`http://localhost/api/events/${others.id}`, { method: "PATCH", body: { title: "hacked" } }),
      { params: { id: others.id } }
    );
    expect(headBlocked.status).toBe(403);

    // Course leads can run check-in for any event, but not edit or delete it.
    asRole("course_lead", "lead1");
    const leadEdit = await PATCH(
      makeRequest(`http://localhost/api/events/${others.id}`, { method: "PATCH", body: { title: "cleaned up" } }),
      { params: { id: others.id } }
    );
    expect(leadEdit.status).toBe(403);
    const leadDel = await DELETE(makeRequest(`http://localhost/api/events/${others.id}`, { method: "DELETE" }), { params: { id: others.id } });
    expect(leadDel.status).toBe(403);
  });

  it("the creator can open check-in and delete their own event", async () => {
    const event = await insertEvent({ title: "mine", created_by: "lead1" });
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

describe("GET /api/events scoping", () => {
  beforeEach(clearAllTestTables);

  it("keeps invitations out of Events but preserves joined history after audience changes", async () => {
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
    await insertEvent({ title: "invited", created_by: "other", check_in_open: true, audience_type: "groups", audience_values: ["1"] });
    await insertEvent({ title: "other group", created_by: "other", check_in_open: true, audience_type: "groups", audience_values: ["2"] });
    const joined = await insertEvent({ title: "joined", created_by: "other", audience_type: "groups", audience_values: ["2"] });
    await testClient().from(table("eventCheckins")).insert({ event_id: joined.id, net_id: "pm1" });
    asRole("pm", "pm1");
    const events = await (await GET(makeRequest("http://localhost/api/events"))).json();
    expect(events.map((event) => event.title)).toEqual(["joined"]);
    const attendance = await (await GET(makeRequest("http://localhost/api/events?scope=checkin"))).json();
    expect(attendance.map((event) => event.title).sort()).toEqual(["invited", "joined"]);
    for (const role of ["head_pm"]) {
      asRole(role, "unrelated");
      expect(await (await GET(makeRequest("http://localhost/api/events"))).json()).toEqual([]);
    }
  });

  it.each([["pm", "PM"]])("defaults %s events to their group and requires an explicit audience without a group", async (role, dbRole) => {
    await insertUser({ net_id: "owner", role: dbRole, group_number: 7 });
    asRole(role, "owner");
    const response = await POST(makeRequest("http://localhost/api/events", { method: "POST", body: { title: "Group meeting", start_time: "2026-01-01T18:00:00.000Z" } }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ audience_type: "groups", audience_values: ["7"] });
    await testClient().from(table("users")).update({ group_number: null }).eq("net_id", "owner");
    expect((await POST(makeRequest("http://localhost/api/events", { method: "POST", body: { title: "No group", start_time: "2026-01-01T18:00:00.000Z" } }))).status).toBe(400);
  });

  it("the Attendance tab (scope=checkin) returns open events plus ones you've attended", async () => {
    const open = await insertEvent({ title: "open", created_by: "pm2", check_in_open: true });
    const closedMine = await insertEvent({ title: "closed attended", created_by: "pm2", check_in_open: false });
    await insertEvent({ title: "closed not attended", created_by: "pm2", check_in_open: false });
    await testClient().from(table("eventCheckins")).insert({ event_id: closedMine.id, net_id: "stu1" });

    asRole("student", "stu1");
    const list = await (await GET(makeRequest("http://localhost/api/events?scope=checkin"))).json();
    expect(list.map((e) => e.title).sort()).toEqual(["closed attended", "open"]);
  });
});

describe("event hosts and course-lead check-in override", () => {
  beforeEach(clearAllTestTables);

  const patch = (id, body) => PATCH(makeRequest(`http://localhost/api/events/${id}`, { method: "PATCH", body }), { params: { id } });
  const code = (id) => GET_CODE(makeRequest(`http://localhost/api/events/${id}/code`), { params: { id } });

  it("a host can run check-in but cannot edit, re-host, or delete the event", async () => {
    const event = await insertEvent({ title: "Workshop", created_by: "pm1", hosts: ["pm2"] });
    asRole("pm", "pm2");

    expect((await patch(event.id, { check_in_open: true })).status).toBe(200);
    expect((await code(event.id)).status).toBe(200);
    expect((await GET_CHECKIN(makeRequest(`http://localhost/api/events/${event.id}/checkin`), { params: { id: event.id } })).status).toBe(200);
    expect((await POST_MANUAL(makeRequest(`http://localhost/api/events/${event.id}/checkin/manual`, { method: "POST", body: { net_id: "stu1" } }), { params: { id: event.id } })).status).toBe(201);

    expect((await patch(event.id, { title: "renamed" })).status).toBe(403);
    expect((await patch(event.id, { check_in_open: false, title: "renamed" })).status).toBe(403);
    expect((await patch(event.id, { hosts: [] })).status).toBe(403);
    expect((await DELETE(makeRequest(`http://localhost/api/events/${event.id}`, { method: "DELETE" }), { params: { id: event.id } })).status).toBe(403);
    const { data } = await testClient().from(table("events")).select("title, check_in_open").eq("id", event.id).single();
    expect(data).toEqual({ title: "Workshop", check_in_open: true });
  });

  it("a course lead can run check-in for any event; other staff cannot", async () => {
    const event = await insertEvent({ title: "Workshop", created_by: "pm1" });
    asRole("head_pm", "head1");
    expect((await patch(event.id, { check_in_open: true })).status).toBe(403);

    asRole("course_lead", "lead1");
    expect((await patch(event.id, { check_in_open: true })).status).toBe(200);
    expect((await code(event.id)).status).toBe(200);
    expect((await patch(event.id, { title: "renamed" })).status).toBe(403);
  });

  it("hosts are set by the creator, must be staff, and see the event in their list", async () => {
    await insertUser({ net_id: "pm1", role: "PM", group_number: 1 });
    await insertUser({ net_id: "pm2", role: "PM", group_number: 2 });
    await insertUser({ net_id: "stu1", role: "STUDENT", group_number: 1 });
    asRole("pm", "pm1");
    const start = "2026-01-01T18:00:00.000Z";
    const bad = await POST(makeRequest("http://localhost/api/events", { method: "POST", body: { title: "x", start_time: start, audience_type: "all", hosts: ["stu1"] } }));
    expect(bad.status).toBe(400);
    const res = await POST(makeRequest("http://localhost/api/events", { method: "POST", body: { title: "Hosted", start_time: start, audience_type: "all", hosts: ["PM2", "pm1"] } }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.hosts).toEqual(["pm2"]);

    asRole("pm", "pm2");
    const list = await (await GET(makeRequest("http://localhost/api/events"))).json();
    expect(list.map((e) => e.title)).toEqual(["Hosted"]);

    asRole("pm", "pm1");
    expect((await (await patch(created.id, { hosts: [] })).json()).hosts).toEqual([]);
    asRole("pm", "pm2");
    expect((await patch(created.id, { check_in_open: true })).status).toBe(403);
  });
});

describe("attendance code + check-in", () => {
  beforeEach(clearAllTestTables);

  it("code endpoint is limited to the creator, hosts, and course leads, and requires check-in to be open", async () => {
    const event = await insertEvent({ title: "e", check_in_open: false, created_by: "pm1" });
    asRole("student", "stu1");
    const forbidden = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    expect(forbidden.status).toBe(403);

    asRole("pm", "pm2"); // a staffer, but not the creator
    const notMine = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    expect(notMine.status).toBe(403);

    asRole("pm", "pm1");
    const notOpen = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    expect(notOpen.status).toBe(400);
  });

  it("check-in stays available for a grace period after the end time, then closes", async () => {
    const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();
    const runningLong = await insertEvent({ title: "running long", check_in_open: false, created_by: "pm1", start_time: minutesAgo(90), end_time: minutesAgo(10) });
    const longOver = await insertEvent({ title: "long over", check_in_open: true, created_by: "pm1", start_time: minutesAgo(120), end_time: minutesAgo(CHECK_IN_GRACE_MS / 60000 + 5) });
    const patch = (id) => PATCH(makeRequest(`http://localhost/api/events/${id}`, { method: "PATCH", body: { check_in_open: true } }), { params: { id } });
    const submit = (id) => POST_CHECKIN(makeRequest(`http://localhost/api/events/${id}/checkin`, { method: "POST", body: { code: deriveCode(id) } }), { params: { id } });

    asRole("pm", "pm1");
    expect((await patch(runningLong.id)).status).toBe(200);
    expect((await GET_CODE(makeRequest(`http://localhost/api/events/${runningLong.id}/code`), { params: { id: runningLong.id } })).status).toBe(200);
    expect((await patch(longOver.id)).status).toBe(400);

    asRole("student", "stu1");
    expect((await submit(runningLong.id)).status).toBe(201);
    expect((await submit(longOver.id)).status).toBe(400);
    const { data } = await testClient().from(table("events")).select("check_in_open").eq("id", longOver.id).single();
    expect(data.check_in_open).toBe(false);
  });

  it("returns a code matching deriveCode() once check-in is open", async () => {
    const event = await insertEvent({ title: "e", check_in_open: true, created_by: "pm1" });
    asRole("pm", "pm1");
    const res = await GET_CODE(makeRequest(`http://localhost/api/events/${event.id}/code`), { params: { id: event.id } });
    const json = await res.json();
    expect(recentCodes(event.id)).toContain(json.code);
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
    const event = await insertEvent({ title: "open", check_in_open: true, created_by: "pm1" });
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

describe("checkInWindowClosed", () => {
  it("only closes once the grace period after the end time has passed", async () => {
    const { checkInWindowClosed } = await import("../../lib/events");
    const end = Date.parse("2026-11-07T18:00:00Z");
    const event = { end_time: new Date(end).toISOString() };
    expect(checkInWindowClosed(event, end - 1)).toBe(false);
    expect(checkInWindowClosed(event, end + 1)).toBe(false);
    expect(checkInWindowClosed(event, end + CHECK_IN_GRACE_MS - 1)).toBe(false);
    expect(checkInWindowClosed(event, end + CHECK_IN_GRACE_MS)).toBe(true);
    expect(checkInWindowClosed({ end_time: null }, end)).toBe(false);
  });
});

describe("check-in guessing limit", () => {
  beforeEach(clearAllTestTables);

  it("refuses check-in after 20 attempts in an hour, even with the right code", async () => {
    await insertUser({ net_id: "stu1", role: "STUDENT" });
    const event = await insertEvent({ title: "Guessable?", check_in_open: true });
    asRole("student", "stu1");
    const attempt = (code) => POST_CHECKIN(makeRequest(`http://localhost/api/events/${event.id}/checkin`, { method: "POST", body: { code } }), { params: { id: event.id } });
    const wrong = deriveCode(event.id) === "000000" ? "111111" : "000000";
    for (let i = 0; i < 20; i++) expect((await attempt(wrong)).status).toBe(400);
    expect((await attempt(deriveCode(event.id))).status).toBe(429);
  });
});
