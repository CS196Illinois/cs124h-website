import { test, expect } from "./fixtures";
import { insertUser, insertSandboxOverlay, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

test.describe("dashboard sandbox mode", () => {
  test.beforeEach(clearAllTestTables);

  test("web_dev can switch modes, and the sidebar banner reflects it without a reload", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-webdev", role: "WEB" });
    await loginAs({ netID: "e2e-webdev", role: "web_dev" });
    await page.goto("/user/web_dev");
    await page.getByText("Sandbox Mode").waitFor();

    // Off by default - no banner.
    await expect(page.getByText("Sandbox active")).not.toBeVisible();

    await page.getByRole("button", { name: /^Persistent/ }).click();
    await expect(page.getByText("Sandbox active (persistent)")).toBeVisible();

    const { data } = await testClient().from(table("users")).select("sandbox_mode").eq("net_id", "e2e-webdev").single();
    expect(data.sandbox_mode).toBe("persistent");

    await page.getByRole("button", { name: /^Ephemeral/ }).click();
    await expect(page.getByText("Sandbox active (ephemeral)")).toBeVisible();
    await expect(page.getByText("Sandbox active (persistent)")).not.toBeVisible();

    await page.getByRole("button", { name: /^Off/ }).click();
    await expect(page.getByText("Sandbox active")).not.toBeVisible();
  });

  test("Reset Sandbox clears the overlay without changing the mode", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-webdev2", role: "WEB", sandbox_mode: "persistent" });
    await insertSandboxOverlay({ owner_net_id: "e2e-webdev2", table_key: "sprints", row_pk: "s1", op: "insert", row_data: { id: "s1" } });
    await loginAs({ netID: "e2e-webdev2", role: "web_dev" });
    await page.goto("/user/web_dev");
    await page.getByText("Sandbox Mode").waitFor();

    await page.getByRole("button", { name: "Reset Sandbox" }).click();
    await expect(page.getByText("Sandbox reset.")).toBeVisible();

    const { data: overlay } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "e2e-webdev2");
    expect(overlay).toHaveLength(0);

    const { data: user } = await testClient().from(table("users")).select("sandbox_mode").eq("net_id", "e2e-webdev2").single();
    expect(user.sandbox_mode).toBe("persistent");
  });

  test("lead_web_dev also has the sandbox panel and banner", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-leadweb2", role: "LEAD_WEB" });
    await loginAs({ netID: "e2e-leadweb2", role: "lead_web_dev" });
    await page.goto("/user/lead_web_dev");
    await page.getByText("Sandbox Mode").waitFor();

    await page.getByRole("button", { name: /^Ephemeral/ }).click();
    await expect(page.getByText("Sandbox active (ephemeral)")).toBeVisible();
  });

  test("a non-sandbox role can't reach the sandbox API", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-pm3", role: "PM" });
    await loginAs({ netID: "e2e-pm3", role: "pm" });
    const res = await page.request.patch("/api/users/me/sandbox", { data: { mode: "persistent" } });
    expect(res.status()).toBe(403);
  });

  test("creating an event through the UI in sandbox mode never touches the real table", async ({ page, loginAs }) => {
    await insertUser({ net_id: "e2e-webdev3", role: "WEB", sandbox_mode: "persistent" });
    await loginAs({ netID: "e2e-webdev3", role: "web_dev" });
    await page.goto("/user/web_dev/events");

    await page.getByRole("button", { name: "+ New Event" }).click();
    await page.getByPlaceholder("e.g. Week 5 Guest Lecture").fill("Sandbox-only workshop");
    await page.getByRole("button", { name: "Create Event" }).click();

    await expect(page.getByText("Sandbox-only workshop")).toBeVisible();

    const { data: real } = await testClient().from(table("events")).select("*").eq("title", "Sandbox-only workshop");
    expect(real).toHaveLength(0);

    const { data: overlay } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "e2e-webdev3").eq("table_key", "events");
    expect(overlay).toHaveLength(1);
    expect(overlay[0].row_data.title).toBe("Sandbox-only workshop");
  });
});
