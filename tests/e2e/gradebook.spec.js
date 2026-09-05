import { test, expect } from "./fixtures";
import { insertUser, insertActionItem, clearAllTestTables } from "../helpers/db";

// A student's own <tr>, found via their exact-text name cell rather than
// `getByRole("row", { name })`: a group row's expanded detail cell wraps a
// whole nested table, so its own accessible name already contains every
// student's name too and would make that locator ambiguous.
function studentRow(page, name) {
  return page.getByRole("cell", { name, exact: true }).locator("xpath=ancestor::tr[1]");
}

test.describe("gradebooks", () => {
  test.beforeEach(clearAllTestTables);

  test("pm gradebook shows their group, drills into a student, and exports CSV", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Sprint Review",
      is_gradable: true, max_score: 100, is_done: true, grade: 88,
    });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/gradebook");

    // Overview tab: flat list (a PM only ever has one group, so there's no
    // group row to expand) with the group average up top.
    await expect(page.getByText("Group Average")).toBeVisible();
    const stu1Row = studentRow(page, "Student One");
    await expect(stu1Row).toContainText("88.0%");

    // Drill into the student to see their full grade history.
    await stu1Row.getByRole("button", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: "Student One" })).toBeVisible();
    await expect(page.getByText("Graded 88/100")).toBeVisible();

    const [studentDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(await studentDownload.path()).toBeTruthy();
    await page.getByRole("button", { name: "Close" }).click();

    // By Assignment tab: the same grade, filtered down to just this one assignment.
    await page.getByRole("button", { name: "By Assignment" }).click();
    await expect(page.getByRole("combobox")).toContainText("Sprint Review"); // auto-selected
    await expect(page.getByText("Graded 88/100")).toBeVisible();

    const [groupDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Group CSV" }).click(),
    ]);
    expect(await groupDownload.path()).toBeTruthy();
  });

  test("course lead gradebook sections by group, drills into an assignment, and exports the full course", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 2 });
    // Both recipients of the same bulk assignment share a batch_id, exactly
    // like a real "assign to specific people" submission would produce -
    // that's what identifies them as one assignment rather than two
    // coincidentally-same-titled ones.
    const batchId = "11111111-1111-1111-1111-111111111111";
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-lead", title: "Proposal", batch_id: batchId,
      is_gradable: true, max_score: 50, is_done: true, grade: 45,
    });
    await insertActionItem({
      net_id: "e2e-stu2", assigned_by: "e2e-lead", title: "Proposal", batch_id: batchId,
      is_gradable: true, max_score: 50, is_done: false,
    });

    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/gradebook");

    // By Group tab: both groups listed, collapsed by default.
    await expect(page.getByText("Course Average")).toBeVisible();
    await expect(page.getByRole("row", { name: /Group 1/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Group 2/ })).toBeVisible();
    await expect(page.getByText("Student One")).not.toBeVisible();

    // Expand Group 1 and drill into the student's full history.
    await page.getByRole("row", { name: /Group 1/ }).click();
    const stu1Row = studentRow(page, "Student One");
    await expect(stu1Row).toContainText("90.0%"); // 45/50
    await stu1Row.getByRole("button", { name: "View" }).click();
    await expect(page.getByText("Graded 45/50")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // By Assignment tab: the one "Proposal" assignment, broken down by group.
    await page.getByRole("button", { name: "By Assignment" }).click();
    await expect(page.getByRole("combobox")).toContainText("Proposal"); // auto-selected
    await page.getByRole("row", { name: /Group 1/ }).click();
    await expect(page.getByText("Graded 45/50")).toBeVisible();
    await page.getByRole("row", { name: /Group 2/ }).click();
    await expect(page.getByText("Pending")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Full Course CSV" }).click(),
    ]);
    expect(await download.path()).toBeTruthy();
  });
});
