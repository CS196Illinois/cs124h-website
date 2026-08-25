import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { insertUser, insertEvent, insertSandboxOverlay, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";
import {
  isSandboxRole,
  getSandboxMode,
  setSandboxMode,
  mergeSandboxRows,
  sandboxWrite,
  resetSandbox,
} from "../../lib/sandbox";

afterAll(clearAllTestTables);

describe("isSandboxRole", () => {
  it("is true only for web_dev and lead_web_dev", () => {
    expect(isSandboxRole("web_dev")).toBe(true);
    expect(isSandboxRole("lead_web_dev")).toBe(true);
    expect(isSandboxRole("course_lead")).toBe(false);
    expect(isSandboxRole("pm")).toBe(false);
    expect(isSandboxRole(undefined)).toBe(false);
  });
});

describe("getSandboxMode / setSandboxMode", () => {
  beforeEach(clearAllTestTables);

  it("defaults to off for a fresh user", async () => {
    const user = await insertUser({ role: "WEB" });
    expect(await getSandboxMode(user.net_id)).toBe("off");
  });

  it("persists a mode change", async () => {
    const user = await insertUser({ role: "WEB" });
    await setSandboxMode(user.net_id, "ephemeral");
    expect(await getSandboxMode(user.net_id)).toBe("ephemeral");

    await setSandboxMode(user.net_id, "persistent");
    expect(await getSandboxMode(user.net_id)).toBe("persistent");
  });

  it("rejects an invalid mode", async () => {
    const user = await insertUser({ role: "WEB" });
    await expect(setSandboxMode(user.net_id, "sorta")).rejects.toThrow(/Invalid sandbox mode/);
  });

  it("returns off for an unknown netID", async () => {
    expect(await getSandboxMode("nobody-here")).toBe("off");
  });
});

describe("mergeSandboxRows", () => {
  beforeEach(clearAllTestTables);

  it("returns baseRows unchanged when there's no overlay", async () => {
    const base = [{ id: "a" }, { id: "b" }];
    const merged = await mergeSandboxRows("owner1", "actionItems", base);
    expect(merged).toEqual(base);
  });

  it("replaces a row with its overlay update", async () => {
    await insertSandboxOverlay({
      owner_net_id: "owner1", table_key: "actionItems", row_pk: "a", op: "update",
      row_data: { id: "a", title: "Edited" },
    });
    const base = [{ id: "a", title: "Original" }, { id: "b", title: "Untouched" }];
    const merged = await mergeSandboxRows("owner1", "actionItems", base);
    expect(merged).toEqual([{ id: "a", title: "Edited" }, { id: "b", title: "Untouched" }]);
  });

  it("omits a row with an overlay delete", async () => {
    await insertSandboxOverlay({ owner_net_id: "owner1", table_key: "actionItems", row_pk: "a", op: "delete", row_data: null });
    const base = [{ id: "a" }, { id: "b" }];
    const merged = await mergeSandboxRows("owner1", "actionItems", base);
    expect(merged).toEqual([{ id: "b" }]);
  });

  it("appends an overlay insert only when it matches the caller's filter", async () => {
    await insertSandboxOverlay({
      owner_net_id: "owner1", table_key: "actionItems", row_pk: "new1", op: "insert",
      row_data: { id: "new1", net_id: "stu1" },
    });
    const base = [{ id: "a", net_id: "stu1" }];

    const matching = await mergeSandboxRows("owner1", "actionItems", base, (row) => row.net_id === "stu1");
    expect(matching).toEqual([{ id: "a", net_id: "stu1" }, { id: "new1", net_id: "stu1" }]);

    const nonMatching = await mergeSandboxRows("owner1", "actionItems", base, (row) => row.net_id === "someone-else");
    expect(nonMatching).toEqual([{ id: "a", net_id: "stu1" }]);
  });

  it("only merges the requesting owner's overlay, not another user's", async () => {
    await insertSandboxOverlay({ owner_net_id: "owner2", table_key: "actionItems", row_pk: "a", op: "delete", row_data: null });
    const base = [{ id: "a" }];
    const merged = await mergeSandboxRows("owner1", "actionItems", base);
    expect(merged).toEqual(base);
  });
});

describe("sandboxWrite", () => {
  beforeEach(clearAllTestTables);

  it("writes an insert that mergeSandboxRows then surfaces", async () => {
    await sandboxWrite("owner1", "sprints", "insert", "s1", { id: "s1", number: 5 });
    const merged = await mergeSandboxRows("owner1", "sprints", [], () => true);
    expect(merged).toEqual([{ id: "s1", number: 5 }]);
  });

  it("collapses repeated writes to the same row_pk into one overlay row", async () => {
    await sandboxWrite("owner1", "sprints", "insert", "s1", { id: "s1", number: 1 });
    await sandboxWrite("owner1", "sprints", "update", "s1", { id: "s1", number: 2 });

    const { data } = await testClient().from(table("sandboxOverlay"))
      .select("*").eq("owner_net_id", "owner1").eq("table_key", "sprints").eq("row_pk", "s1");
    expect(data).toHaveLength(1);
    expect(data[0].row_data.number).toBe(2);
  });

  it("deleting a sandbox-only (insert-op) row removes the overlay entry entirely, no tombstone", async () => {
    await sandboxWrite("owner1", "sprints", "insert", "s1", { id: "s1" });
    await sandboxWrite("owner1", "sprints", "delete", "s1", null);

    const { data } = await testClient().from(table("sandboxOverlay"))
      .select("*").eq("owner_net_id", "owner1").eq("table_key", "sprints").eq("row_pk", "s1");
    expect(data).toHaveLength(0);
  });

  it("deleting a real row leaves a delete tombstone", async () => {
    await sandboxWrite("owner1", "sprints", "update", "real1", { id: "real1", number: 9 });
    await sandboxWrite("owner1", "sprints", "delete", "real1", null);

    const { data } = await testClient().from(table("sandboxOverlay"))
      .select("*").eq("owner_net_id", "owner1").eq("table_key", "sprints").eq("row_pk", "real1");
    expect(data).toHaveLength(1);
    expect(data[0].op).toBe("delete");
  });

  it("throws a 23505-shaped error on a unique conflict against a real row", async () => {
    const event = await insertEvent({});
    // A real checkin already exists for (event.id, "stu1") — simulate by
    // inserting one directly, mirroring what event_checkins would hold.
    await testClient().from(table("eventCheckins")).insert({ event_id: event.id, net_id: "stu1" });

    await expect(
      sandboxWrite(
        "owner1", "eventCheckins", "insert", "new-checkin-1",
        { id: "new-checkin-1", event_id: event.id, net_id: "stu1" },
        { columns: ["event_id", "net_id"] }
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("throws a 23505-shaped error on a unique conflict against another overlay insert", async () => {
    const eventId = randomUUID();
    await sandboxWrite(
      "owner1", "eventCheckins", "insert", "c1",
      { id: "c1", event_id: eventId, net_id: "stu1" },
      { columns: ["event_id", "net_id"] }
    );

    await expect(
      sandboxWrite(
        "owner1", "eventCheckins", "insert", "c2",
        { id: "c2", event_id: eventId, net_id: "stu1" },
        { columns: ["event_id", "net_id"] }
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("does not conflict with itself when updating the same row_pk", async () => {
    const eventId = randomUUID();
    await sandboxWrite(
      "owner1", "eventCheckins", "insert", "c1",
      { id: "c1", event_id: eventId, net_id: "stu1" },
      { columns: ["event_id", "net_id"] }
    );
    // Re-writing the same row_pk with the same unique key must not
    // self-conflict.
    await expect(
      sandboxWrite(
        "owner1", "eventCheckins", "update", "c1",
        { id: "c1", event_id: eventId, net_id: "stu1" },
        { columns: ["event_id", "net_id"] }
      )
    ).resolves.toBeUndefined();
  });

  it("does not conflict with a real row that was deleted in the overlay", async () => {
    const event = await insertEvent({});
    await testClient().from(table("eventCheckins")).insert({ event_id: event.id, net_id: "stu1" }).select().single()
      .then(async ({ data }) => {
        await sandboxWrite("owner1", "eventCheckins", "delete", String(data.id), null);
      });

    await expect(
      sandboxWrite(
        "owner1", "eventCheckins", "insert", "new-checkin-2",
        { id: "new-checkin-2", event_id: event.id, net_id: "stu1" },
        { columns: ["event_id", "net_id"] }
      )
    ).resolves.toBeUndefined();
  });
});

describe("resetSandbox", () => {
  beforeEach(clearAllTestTables);

  it("clears all overlay rows for a user across tables", async () => {
    await sandboxWrite("owner1", "sprints", "insert", "s1", { id: "s1" });
    await sandboxWrite("owner1", "events", "insert", "e1", { id: "e1" });
    await sandboxWrite("owner2", "sprints", "insert", "s2", { id: "s2" });

    await resetSandbox("owner1");

    const { data: owner1Rows } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "owner1");
    expect(owner1Rows).toHaveLength(0);
    const { data: owner2Rows } = await testClient().from(table("sandboxOverlay")).select("*").eq("owner_net_id", "owner2");
    expect(owner2Rows).toHaveLength(1);
  });

  it("clears only the given table when tableKey is passed", async () => {
    await sandboxWrite("owner1", "sprints", "insert", "s1", { id: "s1" });
    await sandboxWrite("owner1", "events", "insert", "e1", { id: "e1" });

    await resetSandbox("owner1", "sprints");

    const { data } = await testClient().from(table("sandboxOverlay")).select("table_key").eq("owner_net_id", "owner1");
    expect(data.map((r) => r.table_key)).toEqual(["events"]);
  });
});
