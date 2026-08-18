"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";
import GradebookView from "../../components/GradebookView";

export default function PMGradebook() {
  const { status } = useSession();
  const [myRecord, setMyRecord] = useState(null);
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, itemsRes] = await Promise.all([
      fetch("/api/users/me"),
      fetch("/api/action_items?scope=all"),
    ]);
    let me = null;
    if (meRes.ok) { me = await meRes.json(); setMyRecord(me); }
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (me?.group_number) {
      const stuRes = await fetch(`/api/users?role=STUDENT&group=${me.group_number}`);
      if (stuRes.ok) setStudents(await stuRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Gradebook</h1>
        <p>{myRecord?.group_number ? `Group ${myRecord.group_number} · ${students.length} student${students.length !== 1 ? "s" : ""}` : "No group assigned"}</p>
      </div>

      {loading ? (
        <div className={styles.panel}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>NetID</th><th>Average</th></tr></thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
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
      ) : !myRecord?.group_number ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            You have no group assigned yet. Contact a Course Lead.
          </div>
        </div>
      ) : (
        <GradebookView
          students={students}
          items={items}
          groupBy={false}
          emptyMessage="No gradable action items assigned to your group yet."
        />
      )}
    </div>
  );
}
