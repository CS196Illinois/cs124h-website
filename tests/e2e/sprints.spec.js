import { test, expect } from "./fixtures";
import { insertUser, insertSprint, clearAllTestTables } from "../helpers/db";

test.describe("sprints: course lead manages sprints, pm marks completions", () => {
  test.beforeEach(clearAllTestTables);

  test("course lead creates, edits, and deletes a sprint", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/sprints");

    await expect(page.getByText("No sprints yet")).toBeVisible();
    await page.getByRole("button", { name: "+ New Sprint" }).click();
    await page.getByPlaceholder("What should students accomplish this sprint?").fill("Ship the MVP");
    await page.getByRole("button", { name: "Create Sprint" }).click();

    await expect(page.getByText("Ship the MVP")).toBeVisible();
    // "Sprint 0" appears both as the selector chip and in the details panel -
    // the chip specifically confirms it was added to the sprint list.
    await expect(page.getByRole("button", { name: "Sprint 0" })).toBeVisible();

    // Edit the goal.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("What should students accomplish this sprint?").fill("Ship the MVP (revised)");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Ship the MVP (revised)")).toBeVisible();

    // Delete is optimistic - an undo toast appears instead of a confirm step.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No sprints yet")).toBeVisible();
  });

  test("pm marks a student in their group complete for a sprint, then unmarks them", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertSprint({ number: 1, goal: "Get the API working" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/students");

    const toggleBtn = page.getByRole("button", { name: "Pending" });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.getByRole("button", { name: "Done ✓" })).toBeVisible();

    // Unmark - back to pending.
    await page.getByRole("button", { name: "Done ✓" }).click();
    await expect(page.getByRole("button", { name: "Pending" })).toBeVisible();
  });
});
