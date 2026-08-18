export async function getGroupPointsSummary() {
  const res = await fetch("/api/public/leaderboard");
  if (!res.ok) {
    console.error("Error fetching leaderboard:", await res.text());
    return [];
  }
  return res.json();
}
