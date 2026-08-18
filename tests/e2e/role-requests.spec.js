import { test, expect } from "./fixtures";
import { insertRoleViewRequest, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

test.describe("role view requests: web_dev requests, lead_web_dev approves/denies/revokes", () => {
  test.beforeEach(clearAllTestTables);

  test("web_dev requests a role view; it shows as pending", async ({ page, loginAs }) => {
    await loginAs({ netID: "e2e-webdev", role: "web_dev" });
    await page.goto("/user/web_dev");

    await expect(page.getByText("PM", { exact: true })).toBeVisible();
    await page.getByText("PM", { exact: true }).locator("..").getByRole("button", { name: "Request" }).click();

    await expect(page.getByText("Pending…")).toBeVisible();
    // The role moves out of the "available to request" list — no more
    // Request button for it while a request is already pending.
    await expect(page.getByText("PM", { exact: true }).locator("..").getByRole("button", { name: "Request" })).toHaveCount(0);
  });

  test("lead_web_dev approves a pending request, which sets an expiry", async ({ page, loginAs }) => {
    await insertRoleViewRequest({ requester_net_id: "e2e-webdev", requested_role: "pm" });

    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev/role_requests");

    await expect(page.getByText("e2e-webdev")).toBeVisible();
    // "Approve" (the row action) vs. "Approved" (the filter tab) - exact avoids the clash.
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Approve Role View Access" })).toBeVisible();
    // Default duration (7 days) is preselected - just confirm.
    await page.getByRole("button", { name: "Approve Access" }).click();

    await expect(page.getByRole("heading", { name: "Approve Role View Access" })).not.toBeVisible();
    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.getByText("e2e-webdev")).toBeVisible();

    const { data } = await testClient().from(table("roleViewRequests")).select("status, expires_at").eq("requester_net_id", "e2e-webdev").single();
    expect(data.status).toBe("approved");
    expect(data.expires_at).toBeTruthy();
    const daysOut = (new Date(data.expires_at) - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysOut).toBeGreaterThan(6);
    expect(daysOut).toBeLessThan(8);
  });

  test("lead_web_dev denies a pending request", async ({ page, loginAs }) => {
    const req = await insertRoleViewRequest({ requester_net_id: "e2e-webdev2", requested_role: "student" });

    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev/role_requests");
    await page.getByRole("button", { name: "Deny" }).click();

    await page.getByRole("button", { name: "Denied" }).click();
    await expect(page.getByText("e2e-webdev2")).toBeVisible();

    const { data } = await testClient().from(table("roleViewRequests")).select("status").eq("id", req.id).single();
    expect(data.status).toBe("denied");
  });

  test("lead_web_dev revokes an approved request, deleting it entirely", async ({ page, loginAs }) => {
    const req = await insertRoleViewRequest({
      requester_net_id: "e2e-webdev3", requested_role: "pm", status: "approved",
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });

    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev/role_requests");
    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.getByText("e2e-webdev3")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("e2e-webdev3")).not.toBeVisible();

    const { data } = await testClient().from(table("roleViewRequests")).select("id").eq("id", req.id).maybeSingle();
    expect(data).toBeNull();
  });
});
