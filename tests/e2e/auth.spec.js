import { test, expect } from "./fixtures";

const ROLE_HOME = {
  course_lead: { path: "/user/course_lead", heading: /course lead/i },
  head_pm: { path: "/user/head_pm", heading: /head pm/i },
  pm: { path: "/user/pm", heading: /pm/i },
  lead_web_dev: { path: "/user/lead_web_dev", heading: /lead web dev/i },
  web_dev: { path: "/user/web_dev", heading: /web dev/i },
  student: { path: "/user/student", heading: /student/i },
};

test.describe("auth + role-gated dashboards", () => {
  test("visiting a /user page while signed out redirects to sign-in", async ({ page }) => {
    await page.goto("/user/pm");
    await expect(page).toHaveURL(/\/signin/);
  });

  for (const [role, { path }] of Object.entries(ROLE_HOME)) {
    test(`${role} can reach their own dashboard`, async ({ page, loginAs }) => {
      await loginAs({ netID: `e2e-${role}`, role });
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    });

    // Covers the post-sign-in flow: /signin defaults callbackUrl to the bare
    // /user root, which app/user/page.js redirects onward from. Regression
    // test for a bug where middleware blocked web_dev at /user itself before
    // that redirect could run, sending them to /unauthorized instead.
    test(`${role} lands on their own dashboard via the bare /user redirect`, async ({ page, loginAs }) => {
      await loginAs({ netID: `e2e-${role}-root`, role });
      await page.goto("/user");
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    });
  }

  test("a student is redirected away from a pm-only page", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-student2", role: "student" });
    await page.goto("/user/pm");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("a pm is redirected away from a course_lead-only page", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-pm2", role: "pm" });
    await page.goto("/user/course_lead");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("lead_web_dev can navigate to any role dashboard", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    await page.goto("/user/course_lead");
    await expect(page).not.toHaveURL(/\/unauthorized/);
  });

  test("web_dev without an approved view is blocked from other dashboards, but not with one", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-webdev", role: "web_dev" });
    await page.goto("/user/pm");
    await expect(page).toHaveURL(/\/unauthorized/);

    await loginAs({ netID: "e2e-webdev", role: "web_dev", approvedViews: ["pm"] });
    await page.goto("/user/pm");
    await expect(page).not.toHaveURL(/\/unauthorized/);
  });
});
