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
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, itemsRes] = await Promise.all([
        fetch("/api/users/me"), fetch("/api/action_items?scope=all&group_scope=true"),
      ]);
      if (!meRes.ok || !itemsRes.ok) throw new Error("Unable to load your gradebook. Please try again.");
      const [me, nextItems] = await Promise.all([meRes.json(), itemsRes.json()]);
      let nextStudents = [];
      if (me?.group_number != null) {
        const res = await fetch(`/api/users?role=STUDENT&group=${encodeURIComponent(me.group_number)}`);
        if (!res.ok) throw new Error("Unable to load students. Please try again.");
        nextStudents = await res.json();
      }
      if (!Array.isArray(nextItems) || !Array.isArray(nextStudents)) throw new Error("Invalid gradebook response. Please try again.");
      setMyRecord(me);
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
        <p>{loading ? "Loading gradebook…" : error ? "Gradebook unavailable" : myRecord?.group_number != null ? `Group ${myRecord.group_number} · ${students.length} student${students.length !== 1 ? "s" : ""}` : "No group assigned"}</p>
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
      ) : myRecord?.group_number == null ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            You have no group assigned yet. Contact a Course Lead.
          </div>
        </div>
      ) : (
        <div data-tour="gradebook-view">
        <GradebookView
          students={students}
          items={items}
          groupBy={false}
          emptyMessage="No gradable action items assigned to your group yet."
        />
        </div>
      )}
    </div>
  );
}
