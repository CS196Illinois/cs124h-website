import { test, expect } from "./fixtures";
import { insertUser, insertActionItem, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

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

  test("pm assigns to a specific student, edits the item, then deletes it", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 2 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 2 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 2 });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");

    await page.getByRole("button", { name: "+ Assign to Group" }).click();
    // The page also has a title-filter <select>, so scope to the modal
    // (h2's parent) to find the "Assign To" select unambiguously.
    const modal = page.getByRole("heading", { name: "Assign Action Item" }).locator("..");
    await modal.getByPlaceholder("Action item…").fill("Individual Task");
    await modal.locator("select").selectOption("individual");
    await page.locator("label", { hasText: "e2e-stu1" }).click();
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText(/Assigned to 1 students?\./)).toBeVisible();
    // The modal auto-closes ~1.2s after success - wait for it to actually
    // close so its own (still-mounted) student picker doesn't double-match text below.
    await expect(page.getByRole("heading", { name: "Assign Action Item" })).not.toBeVisible();

    // Only the targeted student got it, not their groupmate. (The title also
    // appears as a filter-dropdown <option>, so scope to the table cell.)
    await expect(page.getByRole("cell", { name: "Individual Task" })).toBeVisible();
    await expect(page.getByText("e2e-stu1")).toBeVisible();
    await expect(page.getByText("e2e-stu2")).not.toBeVisible();

    // Edit its title. The edit modal's title field is its first text input.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit Action Item" })).toBeVisible();
    await page.locator("input").first().fill("Individual Task (renamed)");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("cell", { name: "Individual Task (renamed)" })).toBeVisible();

    // Delete it - removal is optimistic (an undo toast appears instead of a
    // confirm() dialog), so the row disappears immediately.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Individual Task (renamed)" })).not.toBeVisible();
  });

  test("grading rejects a grade above the item's max score", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 4 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 4 });
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Capped Item",
      is_gradable: true, max_score: 50, is_done: true,
    });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");
    await page.getByRole("button", { name: /Needs Grading/ }).click();
    await page.getByRole("button", { name: "Grade", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Grade Item" })).toBeVisible();
    await page.getByPlaceholder("e.g. 92").fill("999");
    await page.getByRole("button", { name: "Save Grade" }).click();

    await expect(page.getByText("Grade cannot exceed 50.")).toBeVisible();
    // Modal stays open — the bad grade was never saved.
    await expect(page.getByRole("heading", { name: "Grade Item" })).toBeVisible();
  });

  test("reopening a graded item clears its grade and puts it back up for grading", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 5 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 5 });
    await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Graded Item",
      is_gradable: true, max_score: 100, is_done: true, grade: 90,
    });

    // Student reopens their completed item.
    await loginAs({ netID: "e2e-stu1", role: "student" });
    await page.goto("/user/student/action_items");
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText("Score: 90/100")).toBeVisible();
    await page.getByRole("button", { name: "Mark incomplete" }).click();

    // Reopening moves it back to "To Do" and clears the grade.
    await page.getByRole("button", { name: "To Do" }).click();
    await expect(page.getByText("Graded Item")).toBeVisible();
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText("Graded Item")).not.toBeVisible();

    // The pm sees it as a normal open item again, not something to grade —
    // reopening clears is_done too, so it drops out of Needs Grading entirely.
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");
    await expect(page.getByRole("button", { name: "Needs Grading" })).toBeVisible();
    await page.getByRole("button", { name: "Open (1)" }).click();
    // "Graded Item" also appears as an <option> in the title filter - the
    // table cell is the specific thing being asserted on.
    await expect(page.getByRole("cell", { name: "Graded Item" })).toBeVisible();
  });
});

test.describe("undo: deferred-execution safety net for destructive actions", () => {
  test.beforeEach(clearAllTestTables);

  test("clicking Undo restores the item, and the real delete is never sent", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", group_number: 1 });
    const item = await insertActionItem({ net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Undo Me" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");

    await expect(page.getByRole("cell", { name: "Undo Me" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Undo Me" })).not.toBeVisible();

    await expect(page.getByText('Deleted "Undo Me"')).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("cell", { name: "Undo Me" })).toBeVisible();

    // Undo cancels the pending request outright - check the DB immediately
    // (no need to wait out the window) to confirm it was never sent.
    const { data } = await testClient().from(table("actionItems")).select("id").eq("id", item.id).maybeSingle();
    expect(data).not.toBeNull();
  });

  test("letting the undo window run out actually commits the delete", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", group_number: 1 });
    const item = await insertActionItem({ net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Really Delete Me" });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Really Delete Me" })).not.toBeVisible();

    // Wait for the toast to clear on its own (nobody clicked Undo) - that's
    // when the timer fires and the real DELETE request goes out. Confirm the
    // toast appeared first (not.toBeVisible() would otherwise pass trivially
    // before it ever renders), and separately wait for the DELETE response
    // itself - the toast disappearing only means the timer fired, not that
    // the in-flight request has finished.
    const toast = page.getByText('Deleted "Really Delete Me"');
    await expect(toast).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/api/action_items/${item.id}`) && res.request().method() === "DELETE"),
      expect(toast).not.toBeVisible(),
    ]);
    expect(response.ok()).toBe(true);

    const { data } = await testClient().from(table("actionItems")).select("id").eq("id", item.id).maybeSingle();
    expect(data).toBeNull();
  });
});

test.describe("batch delete: undo a bulk assignment in one shot", () => {
  test.beforeEach(clearAllTestTables);

  test("pm deletes a whole batch via Delete Batch, with the same undo safety net", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 1 });
    const batchId = "11111111-1111-4111-8111-111111111111";
    const item1 = await insertActionItem({
      net_id: "e2e-stu1", assigned_by: "e2e-pm", title: "Bulk Item", batch_id: batchId,
      is_gradable: true, is_done: true,
    });
    const item2 = await insertActionItem({
      net_id: "e2e-stu2", assigned_by: "e2e-pm", title: "Bulk Item", batch_id: batchId,
      is_gradable: true, is_done: true,
    });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/action_items");
    await page.getByRole("button", { name: /Needs Grading/ }).click();
    await expect(page.getByText(/2 total in batch/)).toBeVisible();

    await page.getByRole("button", { name: "Delete Batch" }).click();
    await expect(page.getByText(/2 total in batch/)).not.toBeVisible();

    // Undo it - both items should come back as a pending grade batch again.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/2 total in batch/)).toBeVisible();

    // Delete for real this time and let it commit.
    await page.getByRole("button", { name: "Delete Batch" }).click();
    const toast = page.getByText(/Deleted "Bulk Item" for 2 people/);
    await expect(toast).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/api/action_items/batch/${batchId}`) && res.request().method() === "DELETE"),
      expect(toast).not.toBeVisible(),
    ]);
    expect(response.ok()).toBe(true);

    const { data } = await testClient().from(table("actionItems")).select("id").in("id", [item1.id, item2.id]);
    expect(data).toHaveLength(0);
  });

  test("a pm can't delete a batch containing a recipient outside their group", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu-in", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "e2e-stu-out", role: "STUDENT", group_number: 2 });
    const batchId = "22222222-2222-4222-8222-222222222222";
    const inGroup = await insertActionItem({ net_id: "e2e-stu-in", assigned_by: "e2e-pm", title: "Mixed Batch", batch_id: batchId });
    await insertActionItem({ net_id: "e2e-stu-out", assigned_by: "e2e-pm", title: "Mixed Batch", batch_id: batchId });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    const res = await page.request.delete(`/api/action_items/batch/${batchId}`);
    expect(res.status()).toBe(403);

    // Nothing was touched.
    const { data } = await testClient().from(table("actionItems")).select("id").eq("id", inGroup.id).maybeSingle();
    expect(data).not.toBeNull();
  });
});

test.describe("role tags on the action items person accordion", () => {
  test.beforeEach(clearAllTestTables);

  // Regression test: the role tag next to each person's netID used to be a
  // one-off inline style with no font-family, which fell back to the page's
  // serif display font instead of the app's Inter sans-serif — visibly
  // inconsistent with every other role tag in the app (e.g. the People
  // pages), which all go through the shared RoleBadge component/`.badge`
  // CSS class. Now PersonAccordion uses that same shared component, so this
  // asserts the badge actually picks up Inter and is distinctly color-coded
  // per role rather than a flat, unstyled box.
  test("the role tag uses the app's shared badge font and per-role color, not the page's serif fallback", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-lead", role: "LEAD" });
    await insertUser({ net_id: "e2e-badge-stu", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "e2e-badge-pm", role: "PM", group_number: 1 });
    await insertActionItem({ net_id: "e2e-badge-stu", assigned_by: "e2e-lead", title: "Student item" });
    await insertActionItem({ net_id: "e2e-badge-pm", assigned_by: "e2e-lead", title: "PM item" });

    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/action_items");
    await page.getByRole("button", { name: "All Items" }).click();

    // Scoped to <span> — "PM" and "STUDENT" also appear as filter-chip button
    // labels elsewhere on the page.
    const studentBadge = page.locator("span", { hasText: /^STUDENT$/ });
    const pmBadge = page.locator("span", { hasText: /^PM$/ });
    await expect(studentBadge).toBeVisible();
    await expect(pmBadge).toBeVisible();

    const [studentFont, studentColor, pmColor] = await Promise.all([
      studentBadge.evaluate((el) => getComputedStyle(el).fontFamily),
      studentBadge.evaluate((el) => getComputedStyle(el).color),
      pmBadge.evaluate((el) => getComputedStyle(el).color),
    ]);

    expect(studentFont).toContain("Inter");
    expect(studentFont).not.toContain("Playfair");
    // Each role gets a distinct color from the shared badge system — a flat,
    // unstyled tag would render both the same.
    expect(studentColor).not.toBe(pmColor);
  });
});

test.describe("regression: People picker checkbox sizing", () => {
  test.beforeEach(clearAllTestTables);

  // A generic ".formGroup input { width: 100% }" text-input rule was
  // accidentally winning (by CSS specificity) over ".checkboxInput"'s
  // width: 18px for any checkbox nested inside a .formGroup wrapper —
  // stretching the People-picker's per-row checkboxes into full-width
  // bars instead of small squares.
  test("checkboxes in the individual-people picker render as small squares, not full-width bars", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-cbk-lead", role: "LEAD" });
    await insertUser({ net_id: "e2e-cbk-stu", role: "STUDENT", group_number: 1, name: "Checkbox Student" });

    await loginAs({ netID: "e2e-cbk-lead", role: "course_lead" });
    await page.goto("/user/course_lead/action_items");
    await page.getByRole("button", { name: "+ Assign Action Item" }).click();
    await page.getByText("Checkbox Student").waitFor();

    const box = await page.locator('input[type="checkbox"]').first().boundingBox();
    expect(box.width).toBeLessThan(30);
    expect(box.height).toBeLessThan(30);
  });
});

