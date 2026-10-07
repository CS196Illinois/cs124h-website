import { test, expect } from "./fixtures";
import { insertStaff, insertProject, clearAllTestTables } from "../helpers/db";

// None of these tests call loginAs() - that's the point. They lock in the
// contract that course_staff/hall_of_fame render real data for a
// fully signed-out visitor, now that they're served through the public API
// routes instead of a direct (and, per the investigation that led to this,
// broken) anon-key Supabase call.
test.describe("public pages require no auth", () => {
  test.beforeEach(clearAllTestTables);


  test("course staff page renders real staff while signed out", async ({ page }) => {
    await insertStaff({ name: "Publicly Visible Staffer", semester: "Test Semester" });

    await page.goto("/course_staff");
    await expect(page.getByText("Publicly Visible Staffer")).toBeVisible();
  });

  test("hall of fame renders real projects while signed out", async ({ page }) => {
    await insertProject({ title: "Publicly Visible Project", semester: "Test Semester" });

    await page.goto("/hall_of_fame");
    await expect(page.getByText("Publicly Visible Project")).toBeVisible();
  });
});

test("a project with no optional members or image does not crash the hall of fame", async ({ page }) => {
  await clearAllTestTables();
  await insertProject({ title: "Project without optional fields", members: null, image_url: null });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/hall_of_fame");
  await expect(page.getByText("Project without optional fields")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const path of ["/", "/resources", "/timeline", "/course_staff", "/hall_of_fame", "/signin"]) {
  test(`public smoke: ${path} renders on desktop and mobile without script errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.locator("body")).not.toBeEmpty();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
