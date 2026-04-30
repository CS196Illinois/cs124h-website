'use client';
import React, { useState, useEffect } from "react";
import styles from "../../styles/Leaderboard.module.css";
import Navbar from "../../components/navbar";
import { getGroupPointsSummary } from "./leaderboard_supabase";

// const groups = [
//   { rank: 1, name: "Group 1: DOMinators", points: 90 },
//   { rank: 2, name: "Group 10: Swift & Steady", points: 80 },
//   { rank: 3, name: "Group 7: The Dev-iators", points: 65 },
//   { rank: 4, name: "Group 13: Hack Overflow", points: 40 },
//   { rank: 5, name: "Group 3: Cookie Bytes", points: 30 },
//   { rank: 6, name: "Group 8: Stack Breakers", points: 25 },
//   { rank: 7, name: "Group 2: HiHihihi", points: 20 },
// ];

export default function Leaderboard() {
  const [visibleCount, setVisibleCount] = useState(4);
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const newLeaderboardData = await getGroupPointsSummary();
      setLeaderboardData(newLeaderboardData || []);
    };

    fetchData();
  }, []);

  const handleToggle = () => {
    if (visibleCount === leaderboardData.length) {
      setVisibleCount(4);
    } else {
      setVisibleCount(leaderboardData.length);
    }
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>
          Leaderboard{" "}
          <span role="img" aria-label="trophy">
            🏆
          </span>
        </h1>

        <div className={styles.groupList}>
          {leaderboardData.slice(0, visibleCount).map((group, index) => (
            <div
              key={group.rank}
              className={`${styles.card} ${
                index < 3 ? styles.topThree : styles.fourth
              }`}
            >
              <div className={styles.rank}>#{group.rank}</div>
              <div className={styles.name}>{group.group_name}</div>
              <div className={styles.points}>
                Points: <span>{group.total_points}</span> 🏆
              </div>
            </div>
          ))}
        </div>

        <button className={styles.moreButton} onClick={handleToggle}>
          {visibleCount === leaderboardData.length ? "Show Less" : "Show More"}
        </button>
      </div>
    </>
  );
}
