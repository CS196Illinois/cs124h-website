import { supabase } from "../../lib/supbaseClient";

export async function getGroupPointsSummary() {
  const { data, error } = await supabase
    .from("event_attendance_sp26")
    .select("*");

  if (error) {
    console.error("Error fetching attendance:", error.message, error.details, error.hint);
    return [];
  }

  console.log("Fetched rows:", data?.length, "| Sample row:", data?.[0]);
  if (!data || data.length === 0) return [];

  // resolve actual column names case-insensitively
  const sampleKeys = Object.keys(data[0]);
  const groupKey = sampleKeys.find((k) => k.toLowerCase() === "group");
  const totalKey = sampleKeys.find((k) => k.toLowerCase() === "total");

  if (!groupKey || !totalKey) {
    console.error("Could not find group/total columns. Available columns:", sampleKeys);
    return [];
  }

  // group points by group name; each unit of total = 10 points
  const groupSummaryMap = {};
  for (const student of data) {
    const points = (student[totalKey] || 0) * 10;
    const groupName = student[groupKey];

    if (!groupSummaryMap[groupName]) {
      groupSummaryMap[groupName] = {
        group_name: groupName,
        total_points: 0,
      };
    }

    groupSummaryMap[groupName].total_points += points;
  }

  const sortedGroups = Object.values(groupSummaryMap).sort(
    (a, b) => b.total_points - a.total_points
  );

  return sortedGroups.map((group, index) => ({
    ...group,
    rank: index + 1,
  }));
}
