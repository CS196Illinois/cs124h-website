import { test, expect } from "./fixtures";
import { insertSprint, insertUser, clearAllTestTables } from "../helpers/db";

test.beforeEach(clearAllTestTables);

test("a new PM gets an interactive tour that follows the real workflow", async ({ page, loginAs }) => {
  await insertUser({ net_id: "tour-pm", name: "Tour PM", role: "PM", group_number: 1 });
  await insertUser({ net_id: "tour-student", name: "Tour Student", role: "STUDENT", group_number: 1 });
  await insertSprint({ number: 1, goal: "Tour sprint", start_date: "2026-09-01", end_date: "2026-09-30", check_questions: ["What did you learn?"] });
  await loginAs({ netID: "tour-pm", role: "pm", isNewUser: true, onboardingSession: "tour-session" });

  await page.goto("/user/pm");
  const tour = page.locator('[role="dialog"]');
  await expect(tour).toBeVisible();
  await expect(page.locator('[data-tour="nav-dashboard"]')).toBeVisible();

  const steps = [
    ["/user/pm/students", "nav-my-students"],
    ["/user/pm/students", "students-export"],
    ["/user/pm/sprints", "nav-sprints"],
    ["/user/pm/sprints", "sprint-open-check"],
    ["/user/pm/events", "event-new"],
    ["/user/pm/gradebook", "gradebook-view"],
    ["/user/pm/guide", "nav-pm-guide"],
  ];

  for (const [href, target] of steps) {
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${href.replaceAll("/", "\\/")}$`));
    await expect(page.locator(`[data-tour="${target}"]`)).toBeVisible();
  }

  await tour.getByRole("button", { name: "Go to my dashboard", exact: true }).click();
  await expect(tour).not.toBeVisible();
});

test("an existing PM is not interrupted by onboarding", async ({ page, loginAs }) => {
  await insertUser({ net_id: "returning-pm", role: "PM", group_number: 1 });
  await loginAs({ netID: "returning-pm", role: "pm", isNewUser: false });
  await page.goto("/user/pm");
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
