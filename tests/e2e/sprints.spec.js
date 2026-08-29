import { test, expect } from "./fixtures";
import { insertUser, insertSprint, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

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

  // Regression coverage for the undo safety net's onCancel path specifically -
  // handleDelete() in SprintsManager restores not just the sprint row but
  // also selectedId if the deleted sprint was the selected one, so clicking
  // Undo has to put the detail panel back exactly where it was, not just
  // make the chip reappear.
  test("clicking Undo restores a deleted sprint exactly, including which one is selected", async ({ page, loginAs }) => {
    const sprint0 = await insertSprint({ number: 0, goal: "Sprint Zero Goal", start_date: "2026-08-01", end_date: "2026-08-14" });
    await insertSprint({ number: 1, goal: "Sprint One Goal" });

    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/sprints");

    // Select sprint 0 explicitly and delete it while it's the active one.
    await page.getByRole("button", { name: "Sprint 0" }).click();
    await expect(page.getByText("Sprint Zero Goal")).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // It's gone from the chip list and the detail panel fell back to the
    // remaining sprint.
    await expect(page.getByRole("button", { name: "Sprint 0" })).not.toBeVisible();
    await expect(page.getByText("Sprint One Goal")).toBeVisible();

    const toast = page.getByText("Deleted Sprint 0");
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();

    // Sprint 0 is back in the chip list, and selection snapped back to it
    // (not just re-inserted and left unselected) with its exact goal and
    // date range intact.
    await expect(page.getByRole("button", { name: "Sprint 0" })).toBeVisible();
    await expect(page.getByText("Sprint Zero Goal")).toBeVisible();

    // Undo cancels the pending request outright - the row was never touched
    // server-side, so it's still there with every field as originally inserted.
    const { data } = await testClient().from(table("sprints")).select("*").eq("id", sprint0.id).single();
    expect(data.goal).toBe("Sprint Zero Goal");
    expect(data.start_date).toBe("2026-08-01");
    expect(data.end_date).toBe("2026-08-14");
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
