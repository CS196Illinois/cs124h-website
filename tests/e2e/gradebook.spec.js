import { test, expect } from "./fixtures";
import { insertUser, insertActionItem, clearAllTestTables } from "../helpers/db";

test.describe("gradebooks", () => {
  test.beforeEach(clearAllTestTables);

  test("pm gradebook shows their group's graded item and exports CSV", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Sprint Review",
      is_gradable: true, max_score: 100, is_done: true, grade: 88,
    });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/gradebook");

    await expect(page.getByText("Sprint Review")).toBeVisible();
    await expect(page.getByText("88/100")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(await download.path()).toBeTruthy();
  });

  test("course lead gradebook sections students by group and exports all groups", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 2 });
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-lead", title: "Proposal",
      is_gradable: true, max_score: 50, is_done: true, grade: 45,
    });
    await insertActionItem({
      net_id: "e2e-stu2", assigned_by: "e2e-lead", title: "Proposal",
      is_gradable: true, max_score: 50, is_done: false,
    });

    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/gradebook");

    await expect(page.getByText("Group 1")).toBeVisible();
    await expect(page.getByText("Group 2")).toBeVisible();
    await expect(page.getByText("45/50")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export All Groups" }).click(),
    ]);
    expect(await download.path()).toBeTruthy();
  });
});
