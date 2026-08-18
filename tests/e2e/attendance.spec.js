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
});
