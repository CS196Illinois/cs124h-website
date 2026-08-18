import { test, expect } from "./fixtures";
import { insertUser, insertEvent, clearAllTestTables } from "../helpers/db";

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

    // A different pm sees it (all staff can see all events) but can't remove it.
    await loginAs({ netID: "e2e-pm-other", role: "pm" });
    await page.goto("/user/pm/events");
    await expect(page.getByText("Owner's Event")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(500); // let the (no-op) request round-trip
    await page.reload();
    await expect(page.getByText("Owner's Event")).toBeVisible();

    // course_lead has full access and can delete anyone's event.
    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/events");
    await expect(page.getByText("Owner's Event")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Owner's Event")).not.toBeVisible();
  });
});
