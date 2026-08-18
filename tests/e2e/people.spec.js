import { test, expect } from "./fixtures";
import { insertUser, clearAllTestTables } from "../helpers/db";

test.describe("course lead: people management", () => {
  test.beforeEach(clearAllTestTables);

  test("lists seeded people, adds a new person, and exports CSV", async ({ page, loginAs }) => {
    await insertUser({ net_id: "existstu", role: "STUDENT", name: "Existing Student", group_number: 3 });
    await loginAs({ netID: "e2e-lead", role: "course_lead" });

    await page.goto("/user/course_lead/people");
    await expect(page.getByText("existstu")).toBeVisible();
    await expect(page.getByText("Existing Student")).toBeVisible();

    await page.getByRole("button", { name: "+ Add Person" }).click();
    await page.getByPlaceholder("Jane Doe").fill("New Student");
    await page.getByPlaceholder("jdoe2").fill("newstu2");
    // "Add Person" is a substring of "+ Add Person" too (Playwright's name
    // matching is substring by default) — exact match picks the modal's submit button.
    await page.getByRole("button", { name: "Add Person", exact: true }).click();

    await expect(page.getByText("newstu2")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});

test.describe("pm: my students + gradebook CSV export", () => {
  test.beforeEach(clearAllTestTables);

  test("shows only the pm's own group and exports their CSV", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 7 });
    await insertUser({ net_id: "gstu1", role: "STUDENT", name: "Group Student One", group_number: 7 });
    await insertUser({ net_id: "gstu2", role: "STUDENT", name: "Group Student Two", group_number: 7 });
    await insertUser({ net_id: "otherstu", role: "STUDENT", name: "Other Group Student", group_number: 9 });

    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/students");

    // "Group 7 · N students" is rendered twice (page header + toolbar) — .first() avoids the strict-mode ambiguity.
    await expect(page.getByText("Group 7").first()).toBeVisible();
    await expect(page.getByText("gstu1")).toBeVisible();
    await expect(page.getByText("gstu2")).toBeVisible();
    await expect(page.getByText("otherstu")).not.toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(await download.path()).toBeTruthy();
  });
});
