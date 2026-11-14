import { test, expect } from "./fixtures";
import { insertUser, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

const chicagoDay = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(date);

test.describe("schedule", () => {
  test.beforeEach(clearAllTestTables);

  test("a PM adds a weekly group meeting from the schedule; only their group sees it", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 4 });
    await insertUser({ net_id: "e2e-stu", role: "STUDENT", group_number: 4 });
    await insertUser({ net_id: "e2e-other", role: "STUDENT", group_number: 9 });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Add event" }).click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByLabel("Title").fill("Group 4 standup");
    await expect(dialog.getByLabel("Category")).toHaveValue("group_meeting");
    await expect(dialog.getByLabel("Who it's for")).toHaveValue("group");
    await dialog.getByLabel("Repeat every week").check();
    const twoWeeksOut = chicagoDay(new Date(Date.now() + 14 * 86_400_000));
    await dialog.getByLabel("until").fill(twoWeeksOut);
    await dialog.getByRole("button", { name: "Create events" }).click();

    await expect(page.getByRole("status")).toHaveText("Created 3 weekly events.");
    const { data } = await testClient().from(table("events")).select("audience_type, audience_values, created_by").eq("title", "Group 4 standup");
    expect(data).toHaveLength(3);
    expect(data.every((e) => e.audience_type === "groups" && e.audience_values.includes("4") && e.created_by === "e2e-pm")).toBe(true);

    // A student in group 4 sees it, labelled with its category.
    await loginAs({ netID: "e2e-stu", role: "student" });
    await page.goto("/schedule");
    const row = page.locator("li", { hasText: "Group 4 standup" }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("Group meeting");

    // A student in another group, and signed-out visitors, don't.
    await loginAs({ netID: "e2e-other", role: "student" });
    await page.goto("/schedule");
    await expect(page.getByText("Group 4 standup")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add event" })).toHaveCount(0);
  });
});
