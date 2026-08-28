import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { insertEventAttendance, clearAllTestTables } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// The aggregation logic lives server-side in the public route handler now
// (app/leaderboard/leaderboard_supabase.js is just a browser-only fetch()
// shim with no logic left to unit test - relative URLs aren't valid outside
// a browser, so it can't be called directly from Node).
const { GET } = await import("../../app/api/public/leaderboard/route");

afterAll(clearAllTestTables);

describe("GET /api/public/leaderboard", () => {
  beforeEach(clearAllTestTables);

  it("requires no auth, resolves mixed-case columns, and sums points (Total * 10) per group, ranked descending", async () => {
    await insertEventAttendance([
      { name: "Student One", netid: "s1", group: 1, total: 1 },
      { name: "Student Two", netid: "s2", group: 1, total: 1 },
      { name: "Student Three", netid: "s3", group: 2, total: 3 },
    ]);

    const res = await GET(makeRequest("http://localhost/api/public/leaderboard"));
    const summary = await res.json();
    expect(summary[0]).toMatchObject({ group_name: 2, total_points: 30, rank: 1 });
    expect(summary[1]).toMatchObject({ group_name: 1, total_points: 20, rank: 2 });
  });

  it("returns an empty list when there are no rows", async () => {
    const res = await GET(makeRequest("http://localhost/api/public/leaderboard"));
    expect(await res.json()).toEqual([]);
  });

  it("treats a missing/null total as zero points", async () => {
    await insertEventAttendance([{ name: "Student One", netid: "s1", group: 9, total: null }]);
    const res = await GET(makeRequest("http://localhost/api/public/leaderboard"));
    const summary = await res.json();
    expect(summary).toEqual([{ group_name: 9, total_points: 0, rank: 1 }]);
  });
});
