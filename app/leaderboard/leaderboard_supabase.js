import { supabase } from "../../lib/supbaseClient";

export async function getGroupPointsSummary() {
  const { data, error } = await supabase
    .from("event_attendance_sp26")
    .select("name, netid, group, total");

  if (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }

  // group points by group name; each unit of total = 10 points
  const groupSummaryMap = {};
  for (const student of data) {
    const points = (student.total || 0) * 10;
    const groupName = student.group;

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
