import { test, expect } from "./fixtures";
import { insertUser, insertEvent, insertEventCheckin, clearAllTestTables, testClient } from "../helpers/db";
import { deriveCode } from "../../app/api/events/[id]/code/route";
import { table } from "../../lib/tables";

test.describe("events: create, check-in toggle, and creator-scoped permissions", () => {
  test.beforeEach(clearAllTestTables);

  for (const [role, dbRole] of [["pm", "PM"], ["web_dev", "WEB"]]) {
    test(`${role} defaults to their group and can change the audience`, async ({ page, loginAs }) => {
      await insertUser({ net_id: "audience-owner", role: dbRole, group_number: 3 });
      await insertUser({ net_id: "audience-student", role: "STUDENT", group_number: 3 });
      await loginAs({ netID: "audience-owner", role });
      await page.goto(`/user/${role}/events`);
      await page.getByRole("button", { name: "+ New Event" }).click();
      await expect(page.getByRole("radio", { name: /My group · Group 3/ })).toBeChecked();
      await expect(page.getByRole("status").filter({ hasText: "2 people can join" })).toBeVisible();
      if (role === "pm") {
        await page.getByRole("group", { name: "Who is this event for?" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: "test-results/event-audience-desktop.png" });
      }
      await page.getByPlaceholder("e.g. Week 5 Guest Lecture").fill("Audience test");
      await page.getByRole("button", { name: "Create Event" }).click();
      await expect(page.getByText("Groups: 3", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Edit audience" }).click();
      await page.getByRole("radio", { name: /Choose people/ }).check();
      await page.getByRole("searchbox", { name: "Find people" }).fill("audience-student");
      await page.getByRole("checkbox", { name: "audience-student" }).check();
      await page.getByRole("button", { name: "Save audience" }).click();
      await expect(page.getByText("1 selected person", { exact: true })).toBeVisible();
      const { data } = await testClient().from(table("events")).select("audience_type, audience_values").eq("title", "Audience test").single();
      expect(data).toEqual({ audience_type: "people", audience_values: ["audience-student"] });
    });
  }

  test("pm creates an event and opens check-in, exposing a live rotating code", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");

    await page.getByRole("button", { name: "+ New Event" }).click();
    await page.getByPlaceholder("e.g. Week 5 Guest Lecture").fill("Guest Lecture");
    await page.getByPlaceholder("Speaker name (optional)").fill("Dr. Smith");
    await page.getByRole("button", { name: "Create Event" }).click();

    await expect(page.getByText("Guest Lecture")).toBeVisible();
    await expect(page.getByText("● Closed")).toBeVisible();

    await page.getByRole("button", { name: "Open Check-in" }).click();
    await expect(page.getByText("● Open")).toBeVisible();
    await expect(page.getByText("Check-in Code")).toBeVisible();
    // The code is a live 6-digit code that rotates - just confirm one renders.
    await expect(page.locator("text=/^\\d{6}$/")).toBeVisible();

    await page.getByRole("button", { name: "Close Check-in" }).click();
    await expect(page.getByText("● Closed")).toBeVisible();
    await expect(page.getByText("Check-in Code")).not.toBeVisible();
  });

  test("the magnifying glass enlarges the check-in code full-screen, and the close button returns to normal", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    const event = await insertEvent({ title: "Live Workshop", created_by: "e2e-pm", check_in_open: true });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");

    const code = deriveCode(event.id);
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Enlarge check-in code" }).click();
    // The enlarged view shows the same code and event title, full-screen -
    // both also still exist in the (now-background) table row, so scope to
    // the enlarged content itself to stay unambiguous.
    await expect(page.getByRole("button", { name: "Close enlarged code" })).toBeVisible();
    const enlarged = page.locator('[class*="enlargeContent"]');
    await expect(enlarged.getByText("Live Workshop", { exact: true })).toBeVisible();
    await expect(enlarged.getByText(code, { exact: true })).toBeVisible();

    // Regression coverage: the enlarged view also has a QR code + URL for
    // the shared, role-agnostic check-in route, deep-linked to this event.
    const checkInUrl = `${new URL(page.url()).origin}/user/checkin?event=${event.id}`;
    await expect(enlarged.getByRole("link", { name: checkInUrl })).toBeVisible();
    await expect(enlarged.getByAltText("QR code to the check-in link for this event")).toBeVisible();

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const codeBox = await enlarged.locator('[class*="enlargeDigits"]').boundingBox();
      const qrBox = await enlarged.getByAltText("QR code to the check-in link for this event").boundingBox();
      expect(codeBox.x).toBeGreaterThanOrEqual(0);
      expect(codeBox.x + codeBox.width).toBeLessThanOrEqual(width);
      expect(qrBox.x).toBeGreaterThanOrEqual(0);
      expect(qrBox.x + qrBox.width).toBeLessThanOrEqual(width);
    }

    await page.getByRole("button", { name: "Close enlarged code" }).click();
    await expect(page.getByRole("button", { name: "Close enlarged code" })).not.toBeVisible();
    // Still on the events page, code still showing normally.
    await expect(page.getByRole("button", { name: "Enlarge check-in code" })).toBeVisible();
  });

  test("attendee list is empty for an event nobody has checked in to", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertEvent({ title: "Workshop", created_by: "e2e-pm" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");
    await page.getByRole("button", { name: "Attendees" }).click();
    await expect(page.getByText("No check-ins yet.")).toBeVisible();
  });

  // Regression test: viewAttendees() in EventsPanel used to pass an async
  // function directly as the setAttendees updater
  // (`setAttendees(async (prev) => ...)`), which React calls synchronously -
  // the updater's return value (a pending Promise, since it's async) became
  // the new state instead of the resolved attendee list. The PM would always
  // see "0 attendees" no matter how many students had actually checked in.
  test("attendee list shows students who actually checked in", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    const event = await insertEvent({ title: "Workshop", created_by: "e2e-pm" });
    await insertEventCheckin({ event_id: event.id, net_id: "e2e-stu1" });
    await insertEventCheckin({ event_id: event.id, net_id: "e2e-stu2" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");
    await page.getByRole("button", { name: "Attendees" }).click();

    await expect(page.getByText("2 attendees")).toBeVisible();
    await expect(page.getByText("e2e-stu1", { exact: true })).toBeVisible();
    await expect(page.getByText("e2e-stu2", { exact: true })).toBeVisible();
    await expect(page.getByText("No check-ins yet.")).not.toBeVisible();
  });

  test("staff can manually check in a student who didn't use the code", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", group_number: 1, name: "Forgot Their Phone" });
    const event = await insertEvent({ title: "Workshop", created_by: "e2e-pm" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");
    await page.getByRole("button", { name: "Attendees" }).click();
    await expect(page.getByText("No check-ins yet.")).toBeVisible();

    await page.getByPlaceholder("NetID to add…").fill("e2e-stu1");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("1 attendee", { exact: true })).toBeVisible();
    await expect(page.getByText("e2e-stu1", { exact: true })).toBeVisible();
    await expect(page.getByText("No check-ins yet.")).not.toBeVisible();

    const { data } = await testClient()
      .from(table("eventCheckins"))
      .select("net_id")
      .eq("event_id", event.id)
      .single();
    expect(data.net_id).toBe("e2e-stu1");
  });

  test("removing an attendee clears the chip immediately, and Undo restores it without ever hitting the server", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    const event = await insertEvent({ title: "Workshop", created_by: "e2e-pm" });
    await insertEventCheckin({ event_id: event.id, net_id: "e2e-stu1" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");
    await page.getByRole("button", { name: "Attendees" }).click();
    await expect(page.getByText("1 attendee", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Remove e2e-stu1" }).click();
    await expect(page.getByText("No check-ins yet.")).toBeVisible();

    const toast = page.getByText("Removed e2e-stu1 from attendees");
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();

    await expect(page.getByText("1 attendee", { exact: true })).toBeVisible();
    await expect(page.getByText("e2e-stu1", { exact: true })).toBeVisible();

    // Undo cancels the pending request outright - the checkin was never
    // actually deleted server-side.
    const { data } = await testClient()
      .from(table("eventCheckins"))
      .select("net_id")
      .eq("event_id", event.id)
      .single();
    expect(data.net_id).toBe("e2e-stu1");
  });

  // Regression coverage for the undo safety net's onCancel path specifically
  // (the other undo test in this file only exercises the auto-restore-on-403
  // path). Covers that Undo puts back every field, not just the visible
  // title - including check-in being open again, with its live code back.
  test("clicking Undo restores a deleted event exactly, including its open check-in", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    const event = await insertEvent({
      title: "Guest Lecture", description: "Bring a laptop", location: "Siebel 1404",
      presenter: "Dr. Smith", created_by: "e2e-pm", check_in_open: true,
    });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");

    await expect(page.getByText("Events (1)")).toBeVisible();
    await expect(page.getByText("Guest Lecture", { exact: true })).toBeVisible();
    await expect(page.getByText("● Open")).toBeVisible();
    const code = deriveCode(event.id);
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Events (0)")).toBeVisible();
    await expect(page.getByText("Guest Lecture", { exact: true })).not.toBeVisible();

    const toast = page.getByText(/Deleted "Guest Lecture"/);
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();

    // Back in full, including the open check-in state and its live code.
    await expect(page.getByText("Events (1)")).toBeVisible();
    await expect(page.getByText("Guest Lecture", { exact: true })).toBeVisible();
    await expect(page.getByText("● Open")).toBeVisible();
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // Undo cancels the pending request outright - nothing was ever sent
    // server-side, so every field is exactly as originally inserted.
    const { data } = await testClient().from(table("events")).select("*").eq("id", event.id).single();
    expect(data.title).toBe("Guest Lecture");
    expect(data.description).toBe("Bring a laptop");
    expect(data.location).toBe("Siebel 1404");
    expect(data.presenter).toBe("Dr. Smith");
    expect(data.check_in_open).toBe(true);
  });

  test("a pm sees only their own events; the lead web developer sees every event", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm-owner", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-pm-other", role: "PM", group_number: 2 });
    await insertEvent({ title: "Owner's Event", created_by: "e2e-pm-owner" });

    // A different pm doesn't see it at all.
    await loginAs({ netID: "e2e-pm-other", role: "pm" });
    await page.goto("/user/pm/events");
    await expect(page.getByText("No events yet.", { exact: false })).toBeVisible();
    await expect(page.getByText("Owner's Event", { exact: true })).not.toBeVisible();

    // The lead web developer has the full event overview.
    await loginAs({ netID: "e2e-lead", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev/events");
    await expect(page.getByText("Owner's Event", { exact: true })).toBeVisible();

    // And so does the creator.
    await loginAs({ netID: "e2e-pm-owner", role: "pm" });
    await page.goto("/user/pm/events");
    await expect(page.getByText("Owner's Event", { exact: true })).toBeVisible();
  });

  // Regression test: the Start Time / End Time row used `flex: 1` on two
  // <input type="datetime-local"> fields, which can't shrink below their
  // native rendering width in Chromium - on a narrow viewport that pushed
  // the row past the modal's right edge. The modal's `overflow-y: auto`
  // implicitly makes overflow-x `auto` too (CSS spec: one non-visible axis
  // forces the other off `visible`), so this never showed up as
  // document-level overflow - it was a horizontal scrollbar hidden inside
  // the modal, with the End Time field clipped off requiring a scroll
  // nobody would think to do. Checking the modal's own scrollWidth (not the
  // document's) is what actually catches it.
  test("the new event modal has no horizontal overflow on a narrow viewport", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await page.setViewportSize({ width: 360, height: 720 });
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");

    await page.getByRole("button", { name: "+ New Event" }).click();
    await expect(page.getByText("Start Time")).toBeVisible();
    await expect(page.getByText("End Time")).toBeVisible();

    const modal = page.locator("h2", { hasText: "New Event" }).locator("..");
    const overflowX = await modal.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });
});
