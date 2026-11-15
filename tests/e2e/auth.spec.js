import { test, expect } from "./fixtures";
import { clearAllTestTables } from "../helpers/db";

// Signed-in tool pages and the roles allowed on each (see middleware.js).
const TOOL_PAGES = {
  "/checkin": ["student", "pm", "head_pm", "course_lead", "lead_web_dev"],
  "/my-group": ["pm"],
  "/people": ["course_lead", "head_pm"],
  "/support/tickets": ["lead_web_dev"],
};
const ROLES = ["student", "pm", "head_pm", "course_lead", "lead_web_dev"];

test.describe("auth + role-gated pages", () => {
  test.beforeEach(clearAllTestTables);

  test("a signed-out visitor is sent to sign-in and comes back afterward", async ({ page }) => {
    await page.goto("/people");
    await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fpeople/);
  });

  for (const role of ROLES) {
    test(`${role} can open exactly their own tool pages`, async ({ page, loginAs }) => {
      await loginAs({ netID: `e2e-${role}`, role });
      for (const [path, allowed] of Object.entries(TOOL_PAGES)) {
        await page.goto(path);
        if (allowed.includes(role)) await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
        else await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  }

  test("the second top-bar row lists the signed-in role's tools", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-pm-tools", role: "pm" });
    await page.goto("/");
    const tools = page.getByRole("navigation", { name: "PM tools" });
    await expect(tools.getByRole("link", { name: "Check in" })).toBeVisible();
    await expect(tools.getByRole("link", { name: "My group" })).toBeVisible();
    await expect(tools.getByRole("link", { name: "People" })).toHaveCount(0);
  });

  test("old dashboard URLs redirect to where things live now, keeping the query", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-redirect", role: "pm" });
    await page.goto("/user/checkin?event=abc");
    await expect(page).toHaveURL(/\/checkin\?event=abc$/);
    await page.goto("/user/pm/students");
    await expect(page).toHaveURL(/\/my-group$/);
    await page.goto("/user/pm/events");
    await expect(page).toHaveURL(/\/schedule/);
    await page.goto("/user/pm");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  // A student who signed in but isn't on the roster yet (common before
  // kickoff) gets a friendly explanation, not a generic 401.
  test("a signed-in user with no roster role sees a friendly 'not enrolled yet' message, not a generic 401", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-not-enrolled", role: "error" });
    await page.goto("/checkin");
    await expect(page).toHaveURL(/\/unauthorized\?.*reason=not-enrolled/);
    await expect(page.getByText(/not on the roster yet/i)).toBeVisible();
    await expect(page.getByText("401")).not.toBeVisible();
  });

  // A real role mismatch keeps the generic message.
  test("a genuine role mismatch still shows the generic Unauthorized message", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-student-mismatch", role: "student" });
    await page.goto("/people");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByText("401")).toBeVisible();
    await expect(page.getByText(/not on the roster yet/i)).not.toBeVisible();
  });
});
