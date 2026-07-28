"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

export default function HeadPMDashboard() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/head_pm";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, itemsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/action_items"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pms = users.filter((u) => u.role === "PM");
  const students = users.filter((u) => u.role === "STUDENT");
  const groups = [...new Set(students.filter((u) => u.group_number).map((u) => u.group_number))].sort((a, b) => a - b);
  const openItems = actionItems.filter((a) => !a.is_done);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Head PM Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : [
              { label: "PMs", val: pms.length },
              { label: "Students", val: students.length },
              { label: "Groups", val: groups.length },
              { label: "Open Items", val: openItems.length },
            ].map(({ label, val }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNumber}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))
        }
      </div>

      <div className={styles.twoCol}>
        {/* PMs overview */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>PMs by Group</span>
            <Link href={`${base}/people`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
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
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>No PMs yet</div>
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
                          <div>{pm.name || <span style={{ opacity: 0.4 }}>-</span>}</div>
                          <div className={styles.cellMono} style={{ fontSize: "0.78rem", opacity: 0.55 }}>{pm.net_id}</div>
                        </td>
                        <td>{pm.group_number ?? <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td style={{ color: "rgba(249,249,249,0.7)" }}>{groupStudents}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Open action items */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Open Action Items</span>
            <Link href={`${base}/action_items`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}><tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "70%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "50%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "40%" }} /></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ) : openItems.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>No open items</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned To</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {openItems.slice(0, 6).map((item) => (
                    <tr key={item.id}>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</td>
                      <td className={styles.cellMono}>{item.net_id}</td>
                      <td style={{ color: "rgba(249,249,249,0.55)", fontSize: "0.82rem" }}>
                        {item.due_date ? new Date(item.due_date).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {openItems.length > 6 && (
                <div style={{ padding: "0.5rem 0.9rem", color: "rgba(249,249,249,0.35)", fontSize: "0.8rem", fontFamily: "Inter" }}>
                  +{openItems.length - 6} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
