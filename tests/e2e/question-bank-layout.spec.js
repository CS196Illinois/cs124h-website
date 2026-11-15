import { test, expect } from "./fixtures";

for (const width of [390, 1280]) {
  test(`question selection and creation stay usable at ${width}px`, async ({ page, loginAs }) => {
    await page.setViewportSize({ width, height: 900 });
    const bank = [{ id: "q1", question: "What design decisions did you make this week, and why?" }];
    await page.route("**/api/sprints", r => r.fulfill({ json: [] }));
    await page.route("**/api/users?role=STUDENT", r => r.fulfill({ json: [] }));
    await page.route("**/api/sprint-question-bank", async r => {
      if (r.request().method() === "POST") {
        const entry = { id: "q2", ...r.request().postDataJSON() };
        bank.push(entry);
        await r.fulfill({ status: 201, json: entry });
      } else await r.fulfill({ json: bank });
    });
    await loginAs({ netID: "layout-lead", role: "course_lead" });
    await page.goto("/assignments");
    await page.getByRole("button", { name: "+ New Sprint" }).click();
    const dialog = page.getByRole("dialog", { name: "Sprint details" });
    await expect(dialog.getByRole("checkbox")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Edit", exact: true }).focus();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await dialog.getByLabel("New question", { exact: true }).fill("How did you test your design?");
    await dialog.getByRole("button", { name: "Add question", exact: true }).click();
    await expect(dialog.getByRole("checkbox", { name: "How did you test your design?" })).toBeChecked();
    await expect(dialog.getByText("1 selected for this sprint")).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "+ New Sprint" }).click();
    await expect(dialog.getByRole("checkbox", { name: "How did you test your design?" })).not.toBeChecked();
  });
}
