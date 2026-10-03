import { test, expect } from "./fixtures";
import { insertUser, insertSprint, clearAllTestTables } from "../helpers/db";

// "Test As Role → PM" must show a lead web dev the PM experience for their own
// group, not the course-wide list of every group.
test("a lead web dev previewing PM sprints sees only their own group, as a PM does", async ({ page, loginAs }) => {
  await clearAllTestTables();
  await insertUser({ net_id: "e2e-leadweb", role: "LEAD_WEB", group_number: 1, sandbox_mode: "off" });
  await insertUser({ net_id: "e2e-own", role: "STUDENT", name: "Own Group Student", group_number: 1 });
  await insertUser({ net_id: "e2e-other", role: "STUDENT", name: "Other Group Student", group_number: 2 });
  await insertSprint({ number: 1, goal: "Preview sprint", start_date: "2000-01-01", end_date: "2999-01-01", check_questions: ["Required question"] });
  await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
  await page.goto("/user/pm/sprints");

  await expect(page.getByRole("button", { name: "Open Understanding Check" })).toBeVisible();
  await expect(page.getByText("Own Group Student").first()).toBeVisible();
  await expect(page.getByText("Other Group Student")).toHaveCount(0);
  await expect(page.getByText("Group 2", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\/ 1 students in your group marked sprint complete/)).toBeVisible();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
});
