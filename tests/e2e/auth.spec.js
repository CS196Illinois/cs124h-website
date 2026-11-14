import { test, expect } from "./fixtures";
import { clearAllTestTables } from "../helpers/db";

const ROLE_HOME = {
  course_lead: { path: "/user/course_lead", heading: /course lead/i },
  head_pm: { path: "/user/head_pm", heading: /head pm/i },
  pm: { path: "/user/pm", heading: /pm/i },
  lead_web_dev: { path: "/user/lead_web_dev", heading: /support tickets/i },
  student: { path: "/user/student", heading: /student/i },
};

test.describe("auth + role-gated dashboards", () => {
  // Like every other spec, start each test from empty test tables.
  test.beforeEach(clearAllTestTables);

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
    // /user root, which app/user/page.js redirects onward from.
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

  test("lead_web_dev can't open other roles' dashboards", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    for (const path of ["/user/course_lead", "/user/pm", "/user/student"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/unauthorized/);
    }
  });

  // Regression test: a student who has enrolled but hasn't been added to the
  // roster yet (common right before kickoff) shouldn't see a generic 401 -
  // they get a friendlier "not on the roster yet" explanation instead, on
  // both the bare /user root and a specific role path.
  test("a signed-in user with no roster role sees a friendly 'not enrolled yet' message, not a generic 401", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-not-enrolled", role: "error" });

    await page.goto("/user");
    await expect(page).toHaveURL(/\/unauthorized\?.*reason=not-enrolled/);
    await expect(page.getByText(/not on the roster yet/i)).toBeVisible();
    await expect(page.getByText("401")).not.toBeVisible();

    await page.goto("/user/student");
    await expect(page).toHaveURL(/\/unauthorized\?.*reason=not-enrolled/);
    await expect(page.getByText(/not on the roster yet/i)).toBeVisible();
  });

  // A genuine role mismatch (an enrolled user on the wrong dashboard) should
  // keep the generic 401 copy - it's a different situation from not being
  // enrolled yet, and shouldn't be told to "check back after kickoff".
  test("a genuine role mismatch still shows the generic Unauthorized message", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-student-mismatch", role: "student" });
    await page.goto("/user/pm");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByText("401")).toBeVisible();
    await expect(page.getByText(/not on the roster yet/i)).not.toBeVisible();
  });
});
