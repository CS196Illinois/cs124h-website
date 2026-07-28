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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, itemsRes] = await Promise.all([
      fetch("/api/users?role=STUDENT"),
      fetch("/api/action_items?scope=all"),
    ]);
    if (usersRes.ok) setStudents(await usersRes.json());
    if (itemsRes.ok) setItems(await itemsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Gradebook</h1>
        <p>{students.length} student{students.length !== 1 ? "s" : ""} across all groups</p>
      </div>

      {loading ? (
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
          emptyMessage="No gradable action items assigned to students yet."
        />
      )}
    </div>
  );
}
