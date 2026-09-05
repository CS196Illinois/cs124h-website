import { test, expect } from "./fixtures";
import { insertUser, insertSprint, clearAllTestTables } from "../helpers/db";

// This spec is the first to touch six brand-new routes back-to-back
// (/user/pm/sprints, /user/student/sprints, and four /api/sprints/[id]/check
// endpoints), each needing its own on-demand dev-server compile on first hit
// (see playwright.config.mjs's comment on cold-compile time). The project's
// default 10s expect timeout covers a single cold route; this file's tests
// chain several, so both the assertion and overall test timeouts are bumped
// here rather than raising the shared config for every other spec too.
const SLOW = { timeout: 30_000 };

test.describe("sprint understanding checks", () => {
  test.beforeEach(clearAllTestTables);

  test("course lead sets questions, pm opens, student submits, pm grades and closes", async ({ page, loginAs }) => {
    test.setTimeout(180_000);
    await insertUser({ net_id: "e2e-pm", role: "PM", group_number: 1 });
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Student One", group_number: 1 });

    // Course lead: create a sprint with two understanding-check questions.
    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/sprints");
    await page.getByRole("button", { name: "+ New Sprint" }).click();
    await page.locator("textarea").nth(0).fill("Ship the login flow"); // Goal - only textarea before questions are added
    await page.getByRole("button", { name: "+ Add Understanding Check" }).click();
    const textareas = page.locator("textarea");
    await textareas.nth(1).fill("What design decisions did you make?");
    await textareas.nth(2).fill("What alternatives did you consider?");
    await textareas.nth(3).fill("How well did this integrate with your group's work?");
    await page.locator('input[type="number"]').last().fill("20"); // Max Score (Sprint Number is the other number input)
    await page.getByRole("button", { name: "Create Sprint" }).click();
    await expect(page.getByText("Ship the login flow")).toBeVisible(SLOW);
    await expect(page.getByText("What design decisions did you make?")).toBeVisible(SLOW);

    // PM: opens the check for their group.
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/sprints");
    await expect(page.getByText("Ship the login flow")).toBeVisible(SLOW);
    await expect(page.getByText("● Closed")).toBeVisible(SLOW);
    await page.getByRole("button", { name: "Open Check" }).click();
    await expect(page.getByText("● Open")).toBeVisible(SLOW);
    await expect(page.getByText("Not submitted")).toBeVisible(SLOW);

    // Student: the check wasn't visible before, is now, and they submit.
    await loginAs({ netID: "e2e-stu1", role: "student" });
    await page.goto("/user/student/sprints");
    await expect(page.getByText("What design decisions did you make?")).toBeVisible(SLOW);
    const answerBoxes = page.locator("textarea");
    await answerBoxes.nth(0).fill("We used a JWT session because it needed no server-side store.");
    await answerBoxes.nth(1).fill("We considered cookie sessions but wanted stateless scaling.");
    await answerBoxes.nth(2).fill("It plugged directly into the API gateway the rest of the group built.");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Submitted - awaiting grade")).toBeVisible(SLOW);

    // PM: grades the submission, reading the answer text in the grade modal.
    await loginAs({ netID: "e2e-pm", role: "pm" });
    await page.goto("/user/pm/sprints");
    await expect(page.getByText("Ready to grade")).toBeVisible(SLOW);
    await page.getByRole("button", { name: "Grade" }).click();
    await expect(page.getByText("We used a JWT session")).toBeVisible(SLOW);
    await page.getByPlaceholder("e.g. 92").fill("18");
    await page.getByRole("button", { name: "Save Grade" }).click();
    await expect(page.getByText("Graded 18/20")).toBeVisible(SLOW);

    // PM closes the window; the student can still see their graded answer.
    await page.getByRole("button", { name: "Close Check" }).click();
    await expect(page.getByText("● Closed")).toBeVisible(SLOW);

    await loginAs({ netID: "e2e-stu1", role: "student" });
    await page.goto("/user/student/sprints");
    await expect(page.getByText("Grade: 18/20")).toBeVisible(SLOW);
    await expect(page.getByText("We used a JWT session")).toBeVisible(SLOW);
  });

  test("a web dev assigned to a group runs the check like a pm", async ({ page, loginAs }) => {
    test.setTimeout(60_000);
    await insertUser({ net_id: "e2e-web", role: "WEB", group_number: 3 });
    await insertUser({ net_id: "e2e-stu3", role: "STUDENT", name: "Student Three", group_number: 3 });
    await insertSprint({ number: 5, goal: "Web dev sprint", check_questions: ["What did you decide?"], check_max_score: 20 });

    await loginAs({ netID: "e2e-web", role: "web_dev" });
    await page.goto("/user/web_dev/sprints");
    await expect(page.getByText("Web dev sprint")).toBeVisible(SLOW);
    await expect(page.getByText("● Closed")).toBeVisible(SLOW);
    await page.getByRole("button", { name: "Open Check" }).click();
    await expect(page.getByText("● Open")).toBeVisible(SLOW);
    await expect(page.getByText("Not submitted")).toBeVisible(SLOW);
  });

  test("a second student in the group still shows locked until the pm opens it", async ({ page, loginAs }) => {
    test.setTimeout(60_000);
    await insertUser({ net_id: "e2e-pm2", role: "PM", group_number: 2 });
    await insertUser({ net_id: "e2e-stu2", role: "STUDENT", name: "Student Two", group_number: 2 });

    await loginAs({ netID: "e2e-lead", role: "course_lead" });
    await page.goto("/user/course_lead/sprints");
    await page.getByRole("button", { name: "+ New Sprint" }).click();
    await page.locator("textarea").nth(0).fill("Sprint with a check");
    await page.getByRole("button", { name: "+ Add Understanding Check" }).click();
    await page.getByRole("button", { name: "Create Sprint" }).click();

    await loginAs({ netID: "e2e-stu2", role: "student" });
    await page.goto("/user/student/sprints");
    await expect(page.getByText("Not available right now")).toBeVisible(SLOW);
  });
});
