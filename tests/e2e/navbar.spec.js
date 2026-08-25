import { test, expect } from "./fixtures";

// Regression test: the desktop/mobile breakpoint used to be 768px in both
// navbar.js (JS-driven isMobile state) and Navbar.module.css (the media
// query hiding .nav-items), but the full row of nav buttons doesn't
// actually fit on one line until ~1260px — the fixed-height bar has no
// wrap/overflow handling, so between 769px and ~1260px items got clipped
// off-screen or wrapped onto a second line that spilled out of the bar.
test.describe("navbar responsiveness", () => {
  test("shows the full nav row with no horizontal overflow above the breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 500 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Toggle menu" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });

  test("falls back to the hamburger menu at widths where the full row can't fit", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Toggle menu" });
    await expect(toggle).toBeVisible();
    // Scoped to <nav> — the closed mobile sidebar (a sibling of <nav>) keeps
    // its own copy of these links in the DOM off-screen via `right: -300px`,
    // which Playwright still counts as "visible" since it has no
    // display/visibility hiding. The desktop copy inside <nav> is the one
    // that must actually be hidden, not just visually squeezed — that's what
    // used to silently clip/wrap instead.
    await expect(page.locator("nav").getByRole("button", { name: "Timeline" })).not.toBeVisible();

    await toggle.click();
    await expect(page.getByRole("link", { name: "Resources" })).toBeVisible();
  });
});
