import { test, expect } from "./fixtures";

// The full row of links (plus a signed-in role's tabs) only fits from ~1240px up; below that they move into
// a drop-down panel behind the menu button. Regression coverage for the old
// navbar, which clipped or wrapped items between breakpoints.
test.describe("navbar responsiveness", () => {
  test("shows the full nav row with no horizontal overflow above the breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 500 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Toggle menu" })).not.toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Home", "Schedule", "Assignments", "Resources", "Staff", "Hall of Fame", "Course Info"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });

  test("falls back to the menu button at widths where the full row can't fit", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Main" });
    const toggle = page.getByRole("button", { name: "Toggle menu" });
    await expect(toggle).toBeVisible();
    await expect(nav.getByRole("link", { name: "Resources", exact: true })).not.toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await nav.getByRole("link", { name: "Resources", exact: true }).click();
    await expect(page).toHaveURL(/\/resources$/);
    await expect(nav.getByRole("link", { name: "Resources", exact: true })).not.toBeVisible();
  });

  test("the theme toggle switches and remembers the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });
});
