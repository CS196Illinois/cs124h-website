"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../dashboard.module.css";
import { StatGrid, PanelHeader } from "../components/DashboardParts";

export default function HeadPMDashboard() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/head_pm";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes] = await Promise.all([
      fetch("/api/users"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pms = users.filter((u) => u.role === "PM");
  const students = users.filter((u) => u.role === "STUDENT");
  const groups = [...new Set(students.filter((u) => u.group_number).map((u) => u.group_number))].sort((a, b) => a - b);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Head PM Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <StatGrid loading={loading} skeletonCount={3} stats={[
        { label: "PMs", val: pms.length },
        { label: "Students", val: students.length },
        { label: "Groups", val: groups.length },
      ]} />

      {/* PMs overview */}
      <div className={styles.panel}>
        <PanelHeader title="PMs by Group" href={`${base}/people`} />
        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}><tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "70%" }} /></td>
                  <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "30%" }} /></td>
                  <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "20%" }} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        ) : pms.length === 0 ? (
          <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>No PMs yet</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PM</th>
                  <th>Group</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {pms.map((pm) => {
                  const groupStudents = pm.group_number
                    ? students.filter((s) => s.group_number === pm.group_number).length
                    : 0;
                  return (
                    <tr key={pm.net_id}>
                      <td>
                        <div>{pm.name || <span className={styles.muted}>-</span>}</div>
                        <div className={styles.cellMono} style={{ fontSize: "0.78rem", opacity: 0.55 }}>{pm.net_id}</div>
                      </td>
                      <td>{pm.group_number ?? <span className={styles.muted}>-</span>}</td>
                      <td style={{ color: "rgba(249,249,249,0.7)" }}>{groupStudents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
