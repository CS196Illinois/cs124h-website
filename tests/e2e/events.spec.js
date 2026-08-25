import { test, expect } from "./fixtures";
import { insertUser, insertEvent, clearAllTestTables } from "../helpers/db";
import { deriveCode } from "../../app/api/events/[id]/code/route";

test.describe("events: create, check-in toggle, and creator-scoped permissions", () => {
  test.beforeEach(clearAllTestTables);

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

    await page.getByRole("button", { name: "Close enlarged code" }).click();
    await expect(page.getByRole("button", { name: "Close enlarged code" })).not.toBeVisible();
    // Still on the events page, code still showing normally.
    await expect(page.getByRole("button", { name: "Enlarge check-in code" })).toBeVisible();
  });

  test("attendee list shows who checked in, and is empty for an event nobody has", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertEvent({ title: "Workshop", created_by: "e2e-pm" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/events");
    await page.getByRole("button", { name: "Attendees" }).click();
    await expect(page.getByText("No check-ins yet.")).toBeVisible();
  });

  test("a pm cannot delete another pm's event, but course_lead (full access) can", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm-owner", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-pm-other", role: "PM", group_number: 2 });
    await insertEvent({ title: "Owner's Event", created_by: "e2e-pm-owner" });

    // A different pm sees it (all staff can see all events), and deleting it
    // optimistically removes it from their own view - but once the undo
    // window ends and the real request 403s, the undo system auto-restores
    // it, since the action never actually happened server-side.
    // "Owner's Event" also appears (as a substring) inside the undo toast's
    // own message once it's up, so every check on the table row itself uses
    // exact:true to stay unambiguous.
    await loginAs({ netID: "e2e-pm-other", role: "pm" });
    await page.goto("/user/pm/events");
    await expect(page.getByText("Owner's Event", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Owner's Event", { exact: true })).not.toBeVisible();
    // Confirm the toast actually appeared before waiting for it to clear -
    // otherwise not.toBeVisible() below could pass trivially before it ever renders.
    const toast = page.getByText(/Deleted "Owner's Event"/);
    await expect(toast).toBeVisible();
    await expect(toast).not.toBeVisible(); // commit attempted, 403'd
    await expect(page.getByText("Owner's Event", { exact: true })).toBeVisible(); // ...and restored

    // course_lead has full access and can delete anyone's event - this time
    // the commit succeeds, so nothing comes back.
    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/events");
    await expect(page.getByText("Owner's Event", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Owner's Event", { exact: true })).not.toBeVisible();
    const secondToast = page.getByText(/Deleted "Owner's Event"/);
    await expect(secondToast).toBeVisible();
    await expect(secondToast).not.toBeVisible();
    await expect(page.getByText("Owner's Event", { exact: true })).not.toBeVisible(); // stays gone - commit succeeded
  });
});
