import { test, expect } from "./fixtures";
import { insertUser, insertEvent, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";
// There's no dedicated staff "display the code" screen yet (still an open
// tasks.md item), so this covers the half of the flow that does exist:
// the student-facing code entry + check-in.
import { deriveCode } from "../../app/api/events/[id]/code/route";

test.describe("event check-in", () => {
  test.beforeEach(clearAllTestTables);

  test("a student can check in with the correct rotating code", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-stu", role: "STUDENT" });
    const event = await insertEvent({ title: "Live Workshop", check_in_open: true, presenter: "Jane Doe" });

    await loginAs({ netID: "e2e-stu", role: "student" });
    await page.goto("/user/student/attendance");

    await expect(page.getByText("Live Workshop")).toBeVisible();
    await page.getByPlaceholder("6-digit code").fill(deriveCode(event.id));
    await page.getByRole("button", { name: "Check In" }).click();

    await expect(page.getByText(/Checked in to "Live Workshop"/)).toBeVisible();

    const { data } = await testClient().from(table("eventCheckins")).select("net_id").eq("event_id", event.id);
    expect(data.map((r) => r.net_id)).toEqual(["e2e-stu"]);
  });

  test("an incorrect code shows an error and does not check the student in", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-stu", role: "STUDENT" });
    await insertEvent({ title: "Live Workshop", check_in_open: true });

    await loginAs({ netID: "e2e-stu", role: "student" });
    await page.goto("/user/student/attendance");
    await page.getByPlaceholder("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Check In" }).click();

    await expect(page.getByText(/Incorrect code/)).toBeVisible();
  });

  // Regression coverage: check-in used to only be reachable at
  // /user/student/attendance, which middleware restricted to role ===
  // "student" - staff had no way to check themselves into an event they
  // attended. /user/checkin is the shared, role-agnostic route every role's
  // sidebar now links to instead.
  test("any role - not just students - can check in via the shared /user/checkin page", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    const event = await insertEvent({ title: "All-Staff Social", check_in_open: true });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/checkin");

    // Regression coverage: /user/checkin lives outside every role's own
    // layout.js (that's the whole point - it's role-agnostic), which at
    // first meant it rendered with no sidebar at all. checkin/layout.js
    // picks the signed-in user's own sidebar dynamically instead.
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Attendance" })).toBeVisible();

    await expect(page.getByText("All-Staff Social")).toBeVisible();
    await page.getByPlaceholder("6-digit code").fill(deriveCode(event.id));
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByText(/Checked in to "All-Staff Social"/)).toBeVisible();

    const { data } = await testClient().from(table("eventCheckins")).select("net_id").eq("event_id", event.id);
    expect(data.map((r) => r.net_id)).toEqual(["e2e-pm"]);
  });

  // Regression coverage for the QR-code deep link (?event=<id>, generated
  // behind an event's magnifying-glass view) - scanning it should drop
  // someone straight onto that one event's code entry, not a full list they
  // have to search through.
  test("?event=<id> deep-links straight to that one event, focused and ready to type", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-stu", role: "STUDENT" });
    const target = await insertEvent({ title: "Target Talk", check_in_open: true });
    await insertEvent({ title: "Other Talk", check_in_open: true });

    await loginAs({ netID: "e2e-stu", role: "student" });
    await page.goto(`/user/checkin?event=${target.id}`);

    await expect(page.getByText("Target Talk")).toBeVisible();
    await expect(page.getByText("Other Talk")).not.toBeVisible();
    await expect(page.getByPlaceholder("6-digit code")).toBeFocused();

    await page.getByRole("button", { name: "See all open events" }).click();
    await expect(page.getByText("Other Talk")).toBeVisible();
  });
});
