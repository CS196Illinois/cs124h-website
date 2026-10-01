import { test, expect } from "./fixtures";
import { insertUser, insertActionItem, clearAllTestTables } from "../helpers/db";
import { readFile } from "node:fs/promises";

test.beforeEach(clearAllTestTables);

async function seed() {
  await insertUser({ net_id: "ux-student", name: "Student Example", role: "STUDENT", group_number: 1 });
  await insertUser({ net_id: "ux-other", name: "Other Group", role: "STUDENT", group_number: 2 });
  await insertActionItem({ net_id: "ux-student", assigned_by: "ux-manager", title: "Project Review", is_gradable: true, is_done: true, max_score: 50, grade: 0, grade_note: "Please include your test results." });
  await insertActionItem({ net_id: "ux-other", assigned_by: "ux-manager", title: "Private Review", is_gradable: true, is_done: true, max_score: 100, grade: 95 });
}

for (const [role, dbRole, path, grouped] of [
  ["pm", "PM", "pm", false], ["web_dev", "WEB", "web_dev", false],
  ["course_lead", "LEAD", "course_lead", true], ["head_pm", "HEAD", "head_pm", true],
  ["lead_web_dev", "LEAD_WEB", "course_lead", true],
]) {
  test(`${role}: gradebook works with keyboard, feedback, zero scores, and CSV contents`, async ({ page, loginAs }, testInfo) => {
    await seed();
    await insertUser({ net_id: "ux-manager", role: dbRole, group_number: 1 });
    await loginAs({ netID: "ux-manager", role });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/user/${path}/gradebook`);
    if (grouped) {
      const expand = page.getByRole("button", { name: "Expand Group 1", exact: true });
      await expand.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Collapse Group 1", exact: true })).toHaveAttribute("aria-expanded", "true");
    }
    const row = page.getByRole("cell", { name: "Student Example", exact: true }).locator("..");
    await expect(row).toContainText("0.0%");
    const view = row.getByRole("button", { name: "View", exact: true });
    await view.click();
    const dialog = page.getByRole("dialog", { name: "Student Example" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Please include your test results.");
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Export CSV", exact: true })).toBeFocused();
    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Export CSV", exact: true }).click()]);
    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("Project Review");
    expect(csv).toContain("Please include your test results.");
    expect(csv).not.toContain("Private Review");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(view).toBeFocused();
    await page.getByRole("button", { name: "By Assignment", exact: true }).click();
    await expect(page.getByLabel("Assignment", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${role}-desktop.png`), fullPage: true });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole("heading", { name: "Gradebook", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const select = await page.getByLabel("Assignment", { exact: true }).boundingBox();
      expect(select.x + select.width).toBeLessThanOrEqual(width);
      const table = await page.getByRole("table").first().boundingBox();
      expect(table.y).toBeLessThan(744); // Actual results start within the phone viewport.
    }
    await page.screenshot({ path: testInfo.outputPath(`${role}-mobile.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

for (const role of ["pm", "course_lead", "head_pm", "web_dev"]) {
  test(`${role}: failed requests show a recoverable error instead of an empty gradebook`, async ({ page, loginAs }) => {
    await insertUser({ net_id: "ux-manager", role: role === "pm" ? "PM" : role === "web_dev" ? "WEB" : role === "head_pm" ? "HEAD" : "LEAD", group_number: 1 });
    await loginAs({ netID: "ux-manager", role });
    // PM-view gradebooks add &group_scope=true, so match on the scope param.
    const allItems = (url) => url.pathname === "/api/action_items" && url.searchParams.get("scope") === "all";
    await page.route(allItems, (route) => route.fulfill({ status: 500, json: { error: "Database unavailable" } }));
    await page.goto(`/user/${role}/gradebook`);
    const errorAlert = page.getByRole("alert").filter({ hasText: "Unable to load" });
    await expect(errorAlert).toBeVisible();
    await expect(page.getByText("No students in scope yet")).not.toBeVisible();
    await page.unroute(allItems);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("No students in scope yet")).toBeVisible();
    await expect(errorAlert).not.toBeVisible();
  });
}

test("students cannot open staff gradebooks or obtain other students' scores", async ({ page, loginAs }) => {
  await seed();
  await loginAs({ netID: "ux-student", role: "student" });
  for (const role of ["pm", "web_dev", "course_lead", "head_pm", "lead_web_dev"]) {
    await page.goto(`/user/${role}/gradebook`);
    await expect(page).toHaveURL(/\/unauthorized/);
  }
  const response = await page.request.get("/api/action_items?scope=all");
  expect(response.ok()).toBe(true);
  expect((await response.json()).map((item) => item.net_id)).toEqual(["ux-student"]);
});
