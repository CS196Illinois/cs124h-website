import { test, expect } from "./fixtures";
import { insertStaff, insertProject, insertEventAttendance, clearAllTestTables } from "../helpers/db";

// None of these tests call loginAs() - that's the point. They lock in the
// contract that leaderboard/course_staff/hall_of_fame render real data for a
// fully signed-out visitor, now that they're served through the public API
// routes instead of a direct (and, per the investigation that led to this,
// broken) anon-key Supabase call.
test.describe("public pages require no auth", () => {
  test.beforeEach(clearAllTestTables);

  test("leaderboard renders real group standings while signed out", async ({ page }) => {
    // Total is worth 10 points/unit - see app/api/public/leaderboard/route.js.
    await insertEventAttendance([{ name: "Public Student", netid: "pub-stu1", group: 3, total: 3 }]);

    await page.goto("/leaderboard");
    await expect(page.getByText("Group: 3")).toBeVisible();
    await expect(page.getByText("30")).toBeVisible();
  });

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
