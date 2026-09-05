"use client";

import React, { useState, useEffect } from "react";
import styles from "./Leaderboard.module.css";
import { getGroupPointsSummary } from "./leaderboard_supabase";

export default function LeaderboardPage() {
  const [visibleCount, setVisibleCount] = useState(4);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const newLeaderboardData = await getGroupPointsSummary();
      setLeaderboardData(newLeaderboardData || []);
      setLoading(false);
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
    <div>
      <div className={`${styles.pageContainer} pageContainer`}>
        <h1 className={styles.title}>
          Leaderboard{" "}
          <span role="img" aria-label="trophy">
            🏆
          </span>
        </h1>

        {loading ? (
          <div className={styles.groupList}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "20px" }} />
            ))}
          </div>
        ) : (
          <>
            <div className={styles.groupList}>
              {leaderboardData.slice(0, visibleCount).map((group, index) => (
                <div
                  key={group.rank}
                  className={`${styles.card} ${index < 3 ? styles.topThree : styles.fourth}`}
                >
                  <div className={styles.rank}>#{group.rank}</div>
                  <div className={styles.name}>Group: <span>{group.group_name}</span></div>
                  <div className={styles.points}>
                    Points: <span>{group.total_points}</span> 🏆
                  </div>
                </div>
              ))}
            </div>

            <button className={styles.moreButton} onClick={handleToggle}>
              {visibleCount === leaderboardData.length ? "Show Less" : "Show More"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
