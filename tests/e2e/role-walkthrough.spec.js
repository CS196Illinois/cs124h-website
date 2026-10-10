// Role-by-role user flows: people management, import, sprint validation,
// grading edge cases, the student check-in loop, and event audiences.
import { test, expect } from "./fixtures";
import { insertUser, insertSprint, insertEvent, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";
import { recentCodes } from "../helpers/checkinCode";

const SLOW = { timeout: 15_000 };
const db = () => testClient();
const userRow = async (netId) => (await db().from(table("users")).select("*").eq("net_id", netId).maybeSingle()).data;

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  return errors;
}

test.beforeEach(clearAllTestTables);
test.setTimeout(120_000);

test("course lead: people search, filters, role/group edits, remove + undo, duplicates", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-lead", role: "LEAD", name: "Flow Lead" });
  await insertUser({ net_id: "f-s1", role: "STUDENT", name: "Flow One", group_number: 1 });
  await insertUser({ net_id: "f-s2", role: "STUDENT", name: "Flow Two", group_number: 2 });
  await insertUser({ net_id: "f-pm", role: "PM", name: "Flow PM", group_number: 1 });
  await loginAs({ netID: "f-lead", role: "course_lead" });
  await page.goto("/user/course_lead/people");
  await expect(page.getByText("Flow Two")).toBeVisible(SLOW);

  await page.getByPlaceholder("Search name or NetID…").fill("two");
  await expect.soft(page.getByText("Flow One")).toHaveCount(0);
  await expect.soft(page.getByText("Flow Two")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Staff", exact: true }).click();
  await expect.soft(page.getByText("Flow PM")).toBeVisible();
  await expect.soft(page.getByText("Flow One")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();

  await page.getByLabel("Filter by group").selectOption("2");
  await expect.soft(page.getByText("Flow Two")).toBeVisible();
  await expect.soft(page.getByText("Flow One")).toHaveCount(0);
  await page.getByLabel("Filter by group").selectOption("ALL");

  // Inline role change.
  const row = page.getByRole("row").filter({ hasText: "f-s1" });
  await row.getByRole("combobox").selectOption("PM");
  await expect.poll(async () => (await userRow("f-s1"))?.role, SLOW).toBe("PM");

  // Inline group change, then an invalid one.
  const groupBox = page.getByRole("row").filter({ hasText: "f-s1" }).getByPlaceholder("Grp");
  await groupBox.fill("5");
  await groupBox.blur();
  await expect.poll(async () => (await userRow("f-s1"))?.group_number, SLOW).toBe(5);
  await groupBox.fill("-2");
  await groupBox.blur();
  await expect.soft(page.getByText("Enter a whole group number of zero or greater")).toBeVisible();
  await expect.soft(groupBox).toHaveValue("5");
  expect.soft((await userRow("f-s1"))?.group_number).toBe(5);

  // Remove + undo, then remove for real.
  await page.getByRole("row").filter({ hasText: "f-s2" }).getByRole("button", { name: "Remove" }).click();
  await expect.soft(page.getByText("f-s2", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.soft(page.getByText("f-s2", { exact: true })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "f-s2" }).getByRole("button", { name: "Remove" }).click();
  await expect.poll(async () => await userRow("f-s2"), { timeout: 15_000 }).toBeNull();

  // Duplicate NetID is rejected with a message.
  await page.getByRole("button", { name: "+ Add Person" }).click();
  await page.getByPlaceholder("jdoe2").fill("f-pm");
  await page.getByRole("button", { name: "Add Person", exact: true }).click();
  await expect.soft(page.getByText('A user with NetID "f-pm" already exists.')).toBeVisible(SLOW);
  expect.soft(errors).toEqual([]);
});

test("course lead: CSV import adds people with roles and groups", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-lead", role: "LEAD" });
  await loginAs({ netID: "f-lead", role: "course_lead" });
  await page.goto("/user/course_lead/people");
  await page.getByRole("button", { name: "Import CSV / Sheets" }).click();
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({
    name: "roster.csv", mimeType: "text/csv",
    buffer: Buffer.from("NetID,Name,Role,Group\nimp1,Imp One,Student,3\nimp2,Imp Two,PM,\nbad row,,,\n"),
  });
  const importBtn = page.getByRole("button", { name: /^Import \d+ (Person|People)$/ });
  await expect(importBtn).toBeVisible(SLOW);
  await importBtn.click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect.soft(page.getByText("Imp One")).toBeVisible(SLOW);
  const one = await userRow("imp1"), two = await userRow("imp2");
  expect.soft(one && { role: one.role, group: one.group_number }).toEqual({ role: "STUDENT", group: 3 });
  expect.soft(two && { role: two.role, group: two.group_number }).toEqual({ role: "PM", group: null });
  expect.soft(errors).toEqual([]);
});

test("head PM: can only add PMs/students, edits name and group, removes with undo", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-head", role: "HEAD" });
  await insertUser({ net_id: "f-s1", role: "STUDENT", name: "Flow One", group_number: 1 });
  await loginAs({ netID: "f-head", role: "head_pm" });
  await page.goto("/user/head_pm/people");
  await expect(page.getByText("Flow One")).toBeVisible(SLOW);

  await page.getByRole("button", { name: "+ Add Person" }).click();
  const options = await page.locator("select").last().locator("option").allInnerTexts();
  expect.soft(options.sort()).toEqual(["PM", "Student"]);
  await page.getByPlaceholder("Jane Doe").fill("Head Added");
  await page.getByPlaceholder("jdoe2").fill("f-new");
  await page.getByRole("button", { name: "Add Person", exact: true }).click();
  await expect.soft(page.getByText("Head Added")).toBeVisible(SLOW);

  await page.getByRole("row").filter({ hasText: "f-s1" }).getByRole("button", { name: "Edit" }).click();
  await page.getByPlaceholder("Jane Doe").fill("Flow One Renamed");
  await page.getByPlaceholder("e.g. 3").fill("4");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect.poll(async () => { const u = await userRow("f-s1"); return u && [u.name, u.group_number]; }, SLOW).toEqual(["Flow One Renamed", 4]);

  await page.getByRole("row").filter({ hasText: "f-new" }).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.soft(page.getByText("Head Added")).toBeVisible();
  await page.waitForTimeout(9000);
  expect.soft(await userRow("f-new")).not.toBeNull();
  expect.soft(errors).toEqual([]);
});

test("lead web dev: adds a web dev and promotes them", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-lw", role: "LEAD_WEB" });
  await loginAs({ netID: "f-lw", role: "lead_web_dev" });
  await page.goto("/user/lead_web_dev/people");
  await expect(page.getByText("f-lw", { exact: true })).toBeVisible(SLOW);
  await page.getByRole("button", { name: "+ Add Member" }).click();
  await page.getByPlaceholder("Jane Doe").fill("New Web");
  await page.getByPlaceholder("jdoe2").fill("f-web");
  await page.getByRole("button", { name: /^Add/ }).last().click();
  await expect.soft(page.getByText("New Web")).toBeVisible(SLOW);
  await page.getByRole("row").filter({ hasText: "f-web" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("select").last().selectOption("LEAD_WEB");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect.poll(async () => (await userRow("f-web"))?.role, SLOW).toBe("LEAD_WEB");
  expect.soft(errors).toEqual([]);
});

test("course lead: sprint form validation and editing", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertSprint({ number: 1, goal: "Existing", start_date: "2026-10-05", end_date: "2026-10-11" });
  await loginAs({ netID: "f-lead", role: "course_lead" });
  await page.goto("/user/course_lead/sprints");
  await expect(page.getByRole("button", { name: "Sprint 1" })).toBeVisible(SLOW);

  // Duplicate number.
  await page.getByRole("button", { name: "+ New Sprint" }).click();
  await page.locator('input[type="number"]').first().fill("1");
  await page.getByPlaceholder("What should students accomplish this sprint?").fill("Dup");
  await page.getByRole("button", { name: "Create Sprint" }).click();
  await expect.soft(page.getByText("Sprint 1 already exists. Choose a different number.")).toBeVisible(SLOW);
  await page.getByRole("button", { name: "Cancel" }).click();

  // End before start.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator('input[type="date"]').last().fill("2026-10-01");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect.soft(page.getByText("End date must be on or after the start date.")).toBeVisible();
  await page.locator('input[type="date"]').last().fill("2026-10-12");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect.poll(async () => (await db().from(table("sprints")).select("end_date").eq("number", 1).single()).data.end_date, SLOW).toBe("2026-10-12");

  // Empty goal.
  await page.getByRole("button", { name: "+ New Sprint" }).click();
  await page.getByRole("button", { name: "Create Sprint" }).click();
  await expect.soft(page.getByText("Goal is required")).toBeVisible();
  expect.soft(errors).toEqual([]);
});

test("pm grading: invalid grades are rejected, a grade saves, edits, and clears; student sees it", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-pm", role: "PM", group_number: 1 });
  await insertUser({ net_id: "f-stu", role: "STUDENT", name: "Flow Student", group_number: 1 });
  await insertSprint({ number: 1, goal: "Grade flow", check_questions: ["What did you build?"], check_max_score: 10 });

  await loginAs({ netID: "f-pm", role: "pm" });
  await page.goto("/user/pm/sprints");
  await page.getByRole("button", { name: "Open Understanding Check" }).click();
  await expect(page.getByText("● Open")).toBeVisible(SLOW);

  await loginAs({ netID: "f-stu", role: "student" });
  await page.goto("/user/student/sprints");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect.soft(page.getByText("Answer every question before submitting.")).toBeVisible(SLOW);
  await page.locator("textarea").first().fill("A login page");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Submitted - awaiting grade")).toBeVisible(SLOW);

  await loginAs({ netID: "f-pm", role: "pm" });
  await page.goto("/user/pm/sprints");
  await page.getByRole("button", { name: "Grade", exact: true }).click();
  const gradeBox = page.getByPlaceholder("e.g. 92");
  for (const [bad, msg] of [["11", "Grade cannot exceed 10."], ["-1", "Enter a valid, non-negative grade."], ["", "Enter a valid, non-negative grade."]]) {
    await gradeBox.fill(bad);
    await page.getByRole("button", { name: "Save Grade" }).click();
    await expect.soft(page.getByText(msg)).toBeVisible();
  }
  await gradeBox.fill("8");
  await page.getByPlaceholder("Optional feedback…").fill("Solid start");
  await page.getByRole("button", { name: "Save Grade" }).click();
  await expect.soft(page.getByText("Graded 8/10")).toBeVisible(SLOW);

  await loginAs({ netID: "f-stu", role: "student" });
  await page.goto("/user/student/sprints");
  await expect.soft(page.getByText("Grade: 8/10")).toBeVisible(SLOW);
  await expect.soft(page.getByText("Solid start")).toBeVisible();

  await loginAs({ netID: "f-pm", role: "pm" });
  await page.goto("/user/pm/sprints");
  await page.getByRole("button", { name: "Edit Grade" }).click();
  await page.getByRole("button", { name: "Clear Grade" }).click();
  await expect.soft(page.getByText("Ready to grade")).toBeVisible(SLOW);
  expect.soft(errors).toEqual([]);
});

test("student: dashboard alert leads to check-in, which clears the alert; future sprints stay hidden", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-stu", role: "STUDENT", group_number: 1 });
  const plus = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  await insertSprint({ number: 1, goal: "Visible sprint", start_date: plus(-2), end_date: plus(4) });
  await insertSprint({ number: 2, goal: "Hidden future sprint", start_date: plus(9), end_date: plus(15) });
  const ev = await insertEvent({ title: "Flow Event", check_in_open: true, start_time: new Date(Date.now() - 600000).toISOString() });
  await insertEvent({ title: "Other Group Event", check_in_open: true, audience_type: "groups", audience_values: ["2"], start_time: new Date().toISOString() });

  await loginAs({ netID: "f-stu", role: "student" });
  await page.goto("/user/student");
  await expect.soft(page.getByText("Check-in is open for 1 event")).toBeVisible(SLOW);
  await expect.soft(page.getByText("Visible sprint")).toBeVisible();
  await page.getByRole("link", { name: "Check in now →" }).click();
  await expect.soft(page.getByText("Other Group Event")).toHaveCount(0);
  await page.getByPlaceholder("6-digit code").fill(recentCodes(ev.id)[0]);
  await page.getByRole("button", { name: "Check In" }).click();
  await expect.soft(page.getByText(/Checked in to "Flow Event"/)).toBeVisible(SLOW);

  await page.goto("/user/student");
  await expect.soft(page.getByText(/Check-in is open/)).toHaveCount(0);
  await page.goto("/user/student/sprints");
  await expect.soft(page.getByText("Visible sprint")).toBeVisible(SLOW);
  await expect.soft(page.getByText("Hidden future sprint")).toHaveCount(0);
  expect.soft(errors).toEqual([]);
});

test("events: edit audience, close check-in, and sign out", async ({ page, loginAs }) => {
  const errors = watchErrors(page);
  await insertUser({ net_id: "f-lead", role: "LEAD" });
  await insertUser({ net_id: "f-s1", role: "STUDENT", group_number: 1 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs({ netID: "f-lead", role: "course_lead" });
  await page.goto("/user/course_lead/events");
  await page.getByRole("button", { name: "+ New Event" }).click();
  await page.getByPlaceholder("e.g. Week 5 Guest Lecture").fill("Audience edit");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Open to all staff")).toBeVisible(SLOW);
  await page.getByRole("button", { name: "Edit audience" }).click();
  await page.getByRole("radio", { name: /Choose groups/ }).check();
  await page.getByRole("checkbox", { name: /Group 1/ }).check();
  await page.getByRole("button", { name: "Save audience" }).click();
  await expect.soft(page.getByText("Groups: 1", { exact: true })).toBeVisible(SLOW);

  await page.getByRole("button", { name: "Open Check-in" }).click();
  await expect.soft(page.getByText("● Open")).toBeVisible(SLOW);
  await page.getByRole("button", { name: "Close Check-in" }).click();
  await expect.soft(page.getByText("● Closed")).toBeVisible(SLOW);

  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/", SLOW);
  await page.goto("/user/course_lead");
  await expect.soft(page).toHaveURL(/signin/);
  expect.soft(errors).toEqual([]);
});
