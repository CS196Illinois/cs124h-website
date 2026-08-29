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
    // The role moves out of the "available to request" list - no more
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
    await expect(page.getByText("e2e-webdev3", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Revoke" }).click();
    // "e2e-webdev3" also appears as a substring inside the undo toast's own
    // message ("Revoked e2e-webdev3's..."), so this needs exact:true - without
    // it, this assertion blocks for the entire 8s undo window waiting for the
    // toast itself to clear, and every check after it ends up too late.
    await expect(page.getByText("e2e-webdev3", { exact: true })).not.toBeVisible();
    // Revoke is deferred (undo window) - wait for the toast to clear, which
    // is when the timer fires and the real DELETE request goes out. The
    // toast disappearing only means the timer fired, not that the in-flight
    // request has finished, so wait for the response itself too.
    const toast = page.getByText(/Revoked e2e-webdev3's/);
    await expect(toast).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/api/role-view-requests/${req.id}`) && res.request().method() === "DELETE"),
      expect(toast).not.toBeVisible(),
    ]);
    expect(response.ok()).toBe(true);

    const { data } = await testClient().from(table("roleViewRequests")).select("id").eq("id", req.id).maybeSingle();
    expect(data).toBeNull();
  });

  // Regression coverage for the undo safety net's onCancel path specifically -
  // the test above only exercises letting the window run out and commit.
  test("clicking Undo on a revoke restores the approval exactly, including its expiry", async ({ page, loginAs }) => {
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    const req = await insertRoleViewRequest({
      requester_net_id: "e2e-webdev4", requested_role: "student", status: "approved", expires_at: expiresAt,
    });

    await loginAs({ netID: "e2e-leadweb", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev/role_requests");
    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.getByText("e2e-webdev4", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("e2e-webdev4", { exact: true })).not.toBeVisible();

    const toast = page.getByText(/Revoked e2e-webdev4's/);
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();

    // Back in the Approved list, still showing as approved.
    await expect(page.getByText("e2e-webdev4", { exact: true })).toBeVisible();

    // Undo cancels the pending request outright - the row was never touched
    // server-side, so status and expiry are exactly as they were.
    const { data } = await testClient().from(table("roleViewRequests")).select("status, expires_at").eq("id", req.id).single();
    expect(data.status).toBe("approved");
    expect(new Date(data.expires_at).getTime()).toBe(new Date(expiresAt).getTime());
  });
});
