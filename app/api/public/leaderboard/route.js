import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

// Public route — no auth required. The leaderboard is intentionally visible
// to anyone, logged in or not. Runs server-side with the service-role client
// so it doesn't depend on Supabase RLS/anon-key grants, and only returns the
// aggregated group standings — never the underlying per-student rows.
//
// Reconciled with cs124h-website (production): the source of truth is a
// semester-specific attendance table (columns observed as NAME/NETID/GROUP/
// Total — case varies), not the old net_id+group_number+attendance_sheet
// join. Column names are resolved case-insensitively because production hit
// a real casing mismatch here (see cs124h-website commit 93f9ec3b) — same
// defensive lookup is kept here rather than assuming exact casing.
export async function GET() {
  const { data, error } = await supabaseServer
    .from(table("eventAttendanceSp26"))
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json([]);

  const sampleKeys = Object.keys(data[0]);
  const groupKey = sampleKeys.find((k) => k.toLowerCase() === "group");
  const totalKey = sampleKeys.find((k) => k.toLowerCase() === "total");

  if (!groupKey || !totalKey) {
    return NextResponse.json({ error: "Could not resolve group/total columns" }, { status: 500 });
  }

  // Each unit of "total" is worth 10 points — matches production's formula.
  const groupSummaryMap = {};
  for (const row of data) {
    const points = (row[totalKey] || 0) * 10;
    const groupName = row[groupKey];

    if (!groupSummaryMap[groupName]) {
      groupSummaryMap[groupName] = { group_name: groupName, total_points: 0 };
    }
    groupSummaryMap[groupName].total_points += points;
  }

  const rankedGroups = Object.values(groupSummaryMap)
    .sort((a, b) => b.total_points - a.total_points)
    .map((group, index) => ({ ...group, rank: index + 1 }));

  return NextResponse.json(rankedGroups);
}
