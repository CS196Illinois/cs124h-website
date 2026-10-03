import { test, expect } from "./fixtures";

for (const width of [390, 1280]) {
  test(`PM check controls are prominent and usable at ${width}px`, async ({ page, loginAs }) => {
    await page.setViewportSize({ width, height: 900 });
    const sprint = { id: "sprint", number: 1, goal: "Group check", check_questions: ["Required", "Group question"], required_check_questions: ["Required"] };
    let isOpen = false;
    await page.route("**/api/sprints?view=pm", (r) => r.fulfill({ json: [sprint] }));
    await page.route("**/api/users?role=STUDENT", (r) => r.fulfill({ json: [] }));
    await page.route("**/api/users/me", (r) => r.fulfill({ json: { net_id: "pm1", role: "PM", group_number: 1 } }));
    await page.route("**/api/sprint-question-bank?view=pm", (r) => r.fulfill({ json: [{ id: "group-question", question: "Group question", group_number: 1 }] }));
    await page.route("**/api/sprints/sprint/completions", (r) => r.fulfill({ json: [] }));
    await page.route("**/api/sprints/sprint/check?view=pm", (r) => r.fulfill({ json: { hasCheck: true, groupNumber: 1, isOpen, questions: sprint.check_questions, roster: [] } }));
    await page.route("**/api/sprints/sprint/check/open", async (r) => {
      expect(r.request().postDataJSON()).toEqual({ group_number: 1 });
      isOpen = true;
      await r.fulfill({ json: { is_open: true } });
    });
    await loginAs({ netID: "pm1", role: "pm" });
    await page.goto("/user/pm/sprints");
    const open = page.getByRole("button", { name: "Open Understanding Check", exact: true });
    await expect(open).toBeVisible();
    const bounds = await open.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(48);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeLessThan((await page.getByText("Required", { exact: true }).boundingBox()).y);
    await open.click();
    await expect(page.getByRole("button", { name: "Close Understanding Check" })).toBeVisible();
    await expect(page.getByText("Your students can submit their answers now.")).toBeVisible();
    await page.getByRole("button", { name: "Edit Questions", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Required", exact: true })).toBeDisabled();
    const own = page.getByRole("checkbox", { name: "Group question", exact: true });
    await expect(own).toBeEnabled();
    await own.uncheck();
    await expect(own).not.toBeChecked();
  });
}
