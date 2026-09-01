import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { insertUser, insertEvent, insertEventCheckin, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";

// eventAttendanceSync.js has no test-mode equivalent of a real Google
// Sheet - lib/googleSheets.js's actual Sheets/Drive calls are mocked out
// here so this file can exercise the sync's real logic (row-building,
// retry, status persistence, the version-ticket race guard) against real
// test_-prefixed tables, without ever making a real network call.
vi.mock("../../lib/googleSheets", () => ({
  sheetsClient: vi.fn(),
  spreadsheetId: vi.fn(() => "fake-spreadsheet-id"),
  ensureEventTab: vi.fn(),
}));

// eslint-disable-next-line import/order -- must come after vi.mock
import { sheetsClient, ensureEventTab } from "../../lib/googleSheets";
import { performSync, syncWithTicket, loadAttendanceData, isTicketSuperseded, syncEventAttendance } from "../../lib/eventAttendanceSync";

afterAll(clearAllTestTables);

describe("eventAttendanceSync", () => {
  let mockClear, mockUpdate;

  beforeEach(async () => {
    await clearAllTestTables();
    mockClear = vi.fn().mockResolvedValue({});
    mockUpdate = vi.fn().mockResolvedValue({});
    sheetsClient.mockReturnValue({ spreadsheets: { values: { clear: mockClear, update: mockUpdate } } });
    ensureEventTab.mockReset();
    ensureEventTab.mockResolvedValue("Fake Tab Name");
  });

  it("builds the correct header + rows from real check-ins, including role and a blank role for a non-roster guest", async () => {
    await insertUser({ net_id: "e2e-stu1", role: "STUDENT", name: "Stu One" });
    const event = await insertEvent({ title: "Workshop" });
    await insertEventCheckin({ event_id: event.id, net_id: "e2e-stu1" });
    await insertEventCheckin({ event_id: event.id, net_id: "e2e-guest" }); // not on the roster

    const { rows } = await loadAttendanceData(event.id);
    expect(rows[0]).toEqual(["Net ID", "Name", "Role", "Checked In At"]);
    const stu1 = rows.find((r) => r[0] === "e2e-stu1");
    expect(stu1[1]).toBe("Stu One");
    expect(stu1[2]).toBe("Student");
    const guest = rows.find((r) => r[0] === "e2e-guest");
    expect(guest[1]).toBe("");
    expect(guest[2]).toBe("");
  });

  it("writes to the sheet and records sheet_synced_at, clearing any prior error", async () => {
    const event = await insertEvent({ title: "Workshop" });
    await testClient().from(table("events")).update({ sheet_sync_error: "stale error from before" }).eq("id", event.id);

    await performSync(event.id);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const { data } = await testClient()
      .from(table("events"))
      .select("sheet_synced_at, sheet_sync_error")
      .eq("id", event.id)
      .single();
    expect(data.sheet_synced_at).not.toBeNull();
    expect(data.sheet_sync_error).toBeNull();
  });

  it("retries a transient failure and succeeds on a later attempt", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("transient network blip")).mockResolvedValue({});
    const event = await insertEvent({ title: "Workshop" });

    await performSync(event.id);

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const { data } = await testClient().from(table("events")).select("sheet_sync_error").eq("id", event.id).single();
    expect(data.sheet_sync_error).toBeNull();
  });

  it("persists sheet_sync_error and rethrows once every retry is exhausted", async () => {
    mockUpdate.mockRejectedValue(new Error("Sheets API is down"));
    const event = await insertEvent({ title: "Workshop" });

    await expect(performSync(event.id)).rejects.toThrow("Sheets API is down");

    const { data } = await testClient().from(table("events")).select("sheet_sync_error").eq("id", event.id).single();
    expect(data.sheet_sync_error).toBe("Sheets API is down");
  });

  it("isTicketSuperseded reports whether a ticket matches the event's current sync version", async () => {
    const event = await insertEvent({ title: "Workshop" });
    await testClient().from(table("events")).update({ sheet_sync_version: 5 }).eq("id", event.id);

    expect(await isTicketSuperseded(event.id, 5)).toBe(false); // current ticket - not stale
    expect(await isTicketSuperseded(event.id, 4)).toBe(true); // an older ticket - stale
  });

  // Regression coverage for the race two close-together check-ins could
  // hit: an in-flight sync must not overwrite the sheet with a stale
  // snapshot once a newer sync has already claimed a fresher ticket.
  // syncWithTicket() (the retry loop performSync() delegates to once it's
  // claimed its own ticket) is handed a deliberately-stale one directly,
  // so this is deterministic rather than racing two real concurrent calls
  // against timing.
  it("skips writing to the sheet when its ticket has been superseded", async () => {
    const event = await insertEvent({ title: "Workshop" });
    const { rows } = await loadAttendanceData(event.id);
    // A "newer" sync claimed ticket 5 in the meantime.
    await testClient().from(table("events")).update({ sheet_sync_version: 5 }).eq("id", event.id);

    await syncWithTicket(event.id, event, rows, 3); // stale - 3 < current 5

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    // Superseded is a silent no-op, not a failure - nothing should be
    // recorded either way.
    const { data } = await testClient()
      .from(table("events"))
      .select("sheet_synced_at, sheet_sync_error")
      .eq("id", event.id)
      .single();
    expect(data.sheet_synced_at).toBeNull();
    expect(data.sheet_sync_error).toBeNull();
  });

  it("syncEventAttendance stays a hard no-op under USE_TEST_TABLES=true, even with everything else wired up and mocked", async () => {
    const event = await insertEvent({ title: "Workshop" });
    await syncEventAttendance(event.id);
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(ensureEventTab).not.toHaveBeenCalled();
  });
});
