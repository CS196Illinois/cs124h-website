"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";
import GradebookView from "../../components/GradebookView";

export default function CourseLeadGradebook() {
  const { status } = useSession();
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, itemsRes] = await Promise.all([
        fetch("/api/users?role=STUDENT"), fetch("/api/action_items?scope=all"),
      ]);
      if (!usersRes.ok || !itemsRes.ok) throw new Error("Unable to load your gradebook. Please try again.");
      const [nextStudents, nextItems] = await Promise.all([usersRes.json(), itemsRes.json()]);
      if (!Array.isArray(nextStudents) || !Array.isArray(nextItems)) throw new Error("Invalid gradebook response. Please try again.");
      setStudents(nextStudents);
      setItems(nextItems);
    } catch (err) {
      setError(err.message?.startsWith("Unable") ? err.message : "We couldn't load your gradebook. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Gradebook</h1>
        <p>{loading ? "Loading gradebook…" : error ? "Gradebook unavailable" : `${students.length} student${students.length !== 1 ? "s" : ""} across all groups`}</p>
      </div>

      {error ? (
        <div className={styles.alertError} role="alert">
          <p>{error}</p>
          <button className={styles.btnSecondary} onClick={fetchData}>Retry</button>
        </div>
      ) : loading ? (
        <div className={styles.panel}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>NetID</th><th>Average</th></tr></thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "65%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "55%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "30%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <GradebookView
          students={students}
          items={items}
          groupBy
          emptyMessage="No understanding checks submitted yet."
        />
      )}
    </div>
  );
}
