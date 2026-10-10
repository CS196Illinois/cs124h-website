import { it, expect } from "vitest";
import { asRole } from "../helpers/mockAuth";
import { makeRequest } from "../helpers/request";
import { POST as event } from "../../app/api/events/route";

it.each([null, [], { title: 42 }, { title: "Meeting", start_time: "nonsense" }, { title: "Meeting", start_time: "2026-09-10T12:00:00Z", end_time: "2026-09-10T11:00:00Z" }, { title: "Meeting", description: {} }])("rejects malformed event input %j", async (body) => {
  asRole("course_lead", "lead");
  expect((await event(makeRequest("http://localhost/api/events", { method: "POST", body }))).status).toBe(400);
});
