import { test, expect } from "./fixtures";
import { clearAllTestTables, insertSprint, insertUser, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

test("signed-out Dashboard starts no OAuth attempt until the user chooses sign-in", async ({ page, context }) => {
  let attempts = 0;
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "test-csrf" } }));
  await page.route("**/api/auth/signin/cilogon", (route) => {
    attempts += 1;
    return route.fulfill({ json: { url: "http://localhost:3100/signin?error=OAuthCallback" } });
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/support");
  const supportLink = page.getByRole("link", { name: "Support", exact: true });
  await expect(supportLink).toBeVisible();
  await expect(supportLink).toHaveCSS("text-decoration-line", "none");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: "Sign in with Illinois" })).toBeVisible();
  await expect(page.getByText("— no login needed.", { exact: false })).toHaveCount(0);
  expect(attempts).toBe(0);
  await context.addCookies([{ name: "next-auth.state", value: "stale", domain: "localhost", path: "/", httpOnly: true }]);
  await page.getByRole("button", { name: "Sign in with Illinois" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("couldn't complete");
  expect(attempts).toBe(1);
  expect((await context.cookies()).find((cookie) => cookie.name === "next-auth.state")).toBeUndefined();
  await expect(page.getByRole("link", { name: /submit a support ticket/i })).toBeVisible();
});

for (const [role, dbRole] of [["pm", "PM"], ["web_dev", "WEB"]]) {
  test(`${role} sprint totals include only their group`, async ({ page, loginAs }) => {
    await clearAllTestTables();
    await insertUser({ net_id: "group-manager", role: dbRole, group_number: 1 });
    await insertUser({ net_id: "group-student1", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "group-student2", role: "STUDENT", group_number: 1 });
    await insertUser({ net_id: "outside-student", role: "STUDENT", group_number: 2 });
    const sprint = await insertSprint({ number: 1, goal: "Group progress" });
    await testClient().from(table("sprintCompletions")).insert(["group-student1", "outside-student"].map((student_net_id) => ({ sprint_id: sprint.id, student_net_id, marked_by: "lead" })));
    await loginAs({ netID: "group-manager", role });
    await page.goto(`/user/${role}/sprints`);
    const count = page.getByText("/ 2 students in your group complete", { exact: true }).locator("..");
    await expect(count).toHaveText(/1\s*\/ 2 students in your group complete/);
    await expect(page.getByText("outside-student", { exact: true })).toHaveCount(0);
    if (role === "web_dev") await expect(page.getByRole("link", { name: "PM Guide", exact: true })).toBeVisible();
  });
}

test("an invalid session lands on a stable recovery screen with its callback intact", async ({ page, context }) => {
  await context.addCookies([{ name: "next-auth.session-token", value: "corrupt", domain: "localhost", path: "/", httpOnly: true }]);
  await page.goto("/user/student/action_items?tab=done");
  await expect(page).toHaveURL(/\/signin\?/);
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/user/student/action_items?tab=done");
  await expect(page.getByRole("button", { name: "Sign in with Illinois" })).toBeVisible();
});

test("public support accepts a screenshot, preserves form on failure, and shows a receipt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let attempts = 0;
  let firstID;
  await page.route("**/api/support", async (route) => {
    const body = route.request().postDataBuffer().toString();
    expect(body).toContain("Test Student"); expect(body).toContain("student1"); expect(body).toContain("screenshot.png");
    const id = body.match(/name="request_id"\r\n\r\n([^\r]+)/)[1];
    attempts += 1;
    if (attempts === 1) {
      firstID = id;
      await route.fulfill({ status: 503, json: { error: "Please try again." } });
    } else {
      expect(id).toBe(firstID);
      await route.fulfill({ status: 201, json: { id, saved: true, notification: "sent" } });
    }
  });
  await page.goto("/support");
  await page.getByLabel("Full name", { exact: true }).fill("Test Student");
  await page.getByLabel("NetID", { exact: true }).fill("student1");
  await page.getByLabel("Subject", { exact: true }).fill("Login keeps restarting");
  await page.getByLabel("What happened?").fill("I keep returning to the login page after signing in.");
  await page.getByLabel("Screenshots (optional)").setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  await page.screenshot({ path: "test-results/public-support-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Submit support ticket" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Please try again.");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("Login keeps restarting");
  await page.getByRole("button", { name: "Submit support ticket" }).click();
  await expect(page.getByRole("heading", { name: "Your ticket is saved" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(firstID);
});

test("student grades include zero, exclude pending grades, and expose feedback on mobile", async ({ page, loginAs }) => {
  const base = { net_id: "gradeview", is_done: true, is_gradable: true, max_score: 10, assigned_by: "pm1", created_at: "2026-09-10T12:00:00Z", completion_date: "2026-09-12T12:00:00Z" };
  await page.route("**/api/action_items", (route) => route.fulfill({ json: [
    { ...base, id: "zero", title: "Sprint 1 reflection", grade: 0, grade_note: "Please explain your design choices." },
    { ...base, id: "eight", title: "Sprint 2 reflection", grade: 8 },
    { ...base, id: "pending", title: "Sprint 3 reflection", grade: null },
    { ...base, id: "ungraded", title: "Join the team", is_gradable: false, grade: null },
  ] }));
  await loginAs({ netID: "gradeview", role: "student" });
  await page.goto("/user/student/action_items");
  await expect(page.getByText("40.0%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Completed & Grades" }).click();
  await expect(page.getByText("0/10", { exact: true })).toBeVisible();
  await expect(page.getByText("8/10", { exact: true })).toBeVisible();
  await page.getByText("View feedback and details").click();
  await expect(page.getByText("Please explain your design choices.")).toBeVisible();
  await page.screenshot({ path: "test-results/student-grades-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/student-grades-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Show", { exact: true }).selectOption("waiting");
  await expect(page.getByRole("heading", { name: "Sprint 3 reflection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sprint 1 reflection" })).toHaveCount(0);
  await expect(page.getByText("40.0%", { exact: true })).toBeVisible();
});

test("lead developer can read and resolve a ticket and retry a pending notification", async ({ page, loginAs }) => {
  const ticket = { id: "12345678-1111-4111-8111-111111111111", subject: "Help with login", full_name: "Student Name", net_id: "student1", description: "Cannot open my dashboard after signing in.", category: "Login / access", created_at: "2026-09-19T12:00:00Z", status: "open", notification_status: "pending" };
  await page.route("**/api/support**", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      if (body.status) ticket.status = body.status;
      if (body.retry_notification) ticket.notification_status = "sent";
      return route.fulfill({ json: body.retry_notification ? { notification: "sent" } : { id: ticket.id, status: ticket.status } });
    }
    return route.fulfill({ json: [ticket] });
  });
  await loginAs({ netID: "leadweb", role: "lead_web_dev" });
  await page.goto("/user/lead_web_dev/support");
  await expect(page.getByRole("heading", { name: "Help with login" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", /^mailto:student1@illinois.edu/);
  await page.getByRole("button", { name: "Retry email notification" }).click();
  await expect(page.getByText(/Email notification: sent/)).toBeVisible();
  await page.getByRole("button", { name: "Resolve ticket" }).click();
  await expect(page.getByRole("button", { name: "Reopen ticket" })).toBeVisible();
});

test("PM sees saved non-bank questions locked and can append a new question", async ({ page, loginAs }) => {
  await clearAllTestTables();
  await insertUser({ net_id: "pm-lock", role: "PM", group_number: 1 });
  const sprint = await insertSprint({ number: 1, goal: "Protected sprint", check_questions: ["Required course lead question"], check_max_score: 20 });
  await loginAs({ netID: "pm-lock", role: "pm" });
  await page.goto("/user/pm/sprints");
  await page.getByRole("button", { name: /edit.*check|edit.*question/i }).click();
  await expect(page.getByRole("checkbox", { name: "Required course lead question" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Required course lead question" })).toBeDisabled();
  await expect(page.getByLabel("Maximum score")).toBeDisabled();
  await page.locator('input[type="checkbox"]:not(:disabled)').first().check();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByLabel("Maximum score")).toHaveCount(0);
  const { data } = await testClient().from(table("sprints")).select("check_questions, check_max_score").eq("id", sprint.id).single();
  expect(data.check_questions[0]).toBe("Required course lead question");
  expect(data.check_questions).toHaveLength(2);
  expect(data.check_max_score).toBe(20);
});
