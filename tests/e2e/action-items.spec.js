import { test, expect } from "./fixtures";
import { insertUser, clearAllTestTables } from "../helpers/db";

test.describe("action items: assign, complete, and grade", () => {
  test.beforeEach(clearAllTestTables);

  test("pm bulk-assigns a gradable item to their group, a student completes it, and the pm grades the batch", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 1 });

    // ── PM assigns a gradable item to the whole group (bulk -> shared batch) ──
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");

    await page.getByRole("button", { name: "+ Assign to Group" }).click();
    await page.getByPlaceholder("Action item…").fill("Sprint Review");
    await page.getByLabel("Gradable").check();
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText(/Assigned to 2 students?\./)).toBeVisible();

    // ── Student One marks it complete ──
    await loginAs({ netID: "e2e-stu1", role: "student" });
    await page.goto("/user/student/action_items");
    await expect(page.getByText("Sprint Review")).toBeVisible();
    await page.getByRole("button", { name: "Mark complete" }).first().click();
    // Completing the item moves it out of the "To Do" tab and into "Completed".
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText("Awaiting grade")).toBeVisible();

    // ── PM sees one collapsed batch entry ready to grade ──
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");
    await page.getByRole("button", { name: /Needs Grading/ }).click();
    const gradeBatchBtn = page.getByRole("button", { name: /Grade Batch \(1\)/ });
    await expect(gradeBatchBtn).toBeVisible();
    await expect(page.getByText(/2 total in batch/)).toBeVisible();

    await gradeBatchBtn.click();
    await expect(page.getByRole("heading", { name: "Grade Batch" })).toBeVisible();
    await page.locator('input[type="number"]').first().fill("95");
    await page.getByRole("button", { name: "Save Grades" }).click();

    // Batch modal closes and the item no longer needs grading
    await expect(page.getByRole("heading", { name: "Grade Batch" })).not.toBeVisible();
  });
});
