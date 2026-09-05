import { test, expect } from "./fixtures";
import { insertUser, insertActionItem, insertSprint, clearAllTestTables } from "../helpers/db";

// A web dev is also a PM: the dashboard carries the PM panels and every PM page
// must render under /user/web_dev, reachable from the sidebar. The PM pages
// themselves are verbatim re-exports, so this guards the wiring (dashboard
// merge, sidebar hrefs, layout, re-export) rather than page internals.
const SLOW = { timeout: 30_000 };

test.describe("web dev doubling as a PM", () => {
  test.beforeEach(clearAllTestTables);

  test("the dashboard is PM-flavored and every PM page is reachable from the sidebar", async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    await insertUser({ net_id: "e2e-webpm", role: "WEB", name: "Web PM", group_number: 4 });
    await insertUser({ net_id: "e2e-s1", role: "STUDENT", name: "Group Four Student", group_number: 4 });
    await insertActionItem({ net_id: "e2e-s1", assigned_by: "e2e-webpm", title: "Wire up the form", is_gradable: true, max_score: 100, is_done: true });
    await insertSprint({
      number: 7, goal: "Ship the dashboard",
      start_date: "2000-01-01", end_date: "2999-01-01",
    });

    await loginAs({ netID: "e2e-webpm", role: "web_dev" });

    // Dashboard: PM panels are present alongside the web-dev-only ones.
    await page.goto("/user/web_dev");
    await expect(page.getByText("· Group 4")).toBeVisible(SLOW);       // PM header
    await expect(page.getByText("Ship the dashboard")).toBeVisible(SLOW); // PM current-sprint card
    await expect(page.getByText("Group Four Student")).toBeVisible(SLOW); // PM students preview
    await expect(page.getByText("Role View Access")).toBeVisible(SLOW);   // web-dev-only panel still present

    await page.getByRole("link", { name: "My Students" }).click();
    await expect(page).toHaveURL(/\/user\/web_dev\/students$/);
    await expect(page.getByRole("heading", { name: "My Students" })).toBeVisible(SLOW);
    await expect(page.getByText("Group Four Student")).toBeVisible(SLOW);

    await page.getByRole("link", { name: "Gradebook" }).click();
    await expect(page).toHaveURL(/\/user\/web_dev\/gradebook$/);
    await expect(page.getByRole("heading", { name: "Gradebook" })).toBeVisible(SLOW);
    await expect(page.getByText("Group 4", { exact: false })).toBeVisible(SLOW);

    await page.getByRole("link", { name: "Action Items" }).click();
    await expect(page).toHaveURL(/\/user\/web_dev\/action_items$/);
    await expect(page.getByRole("heading", { name: "Group Action Items" })).toBeVisible(SLOW);

    await page.getByRole("link", { name: "Sprints" }).click();
    await expect(page).toHaveURL(/\/user\/web_dev\/sprints$/);
    await expect(page.getByRole("heading", { name: "Sprints" })).toBeVisible(SLOW);
  });
});
