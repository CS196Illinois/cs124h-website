"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

function roleBadge(roleId, roles, s) {
  const def = roles.find((r) => r.id === roleId);
  return <span className={`${s.badge} ${def ? s[def.badgeClass] : ""}`}>{roleId}</span>;
}

export default function CourseLeadDashboard() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/course_lead";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, rolesRes, itemsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles"),
      fetch("/api/action_items"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const countByRole = Object.fromEntries(roles.map((r) => [r.id, users.filter((u) => u.role === r.id).length]));
  const openItems = actionItems.filter((a) => !a.is_done);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Course Lead Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : [
              ...roles.map((r) => ({ label: `${r.label}s`, val: countByRole[r.id] ?? 0 })),
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
        {/* People overview */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Team Overview</span>
            <Link href={`${base}/people`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              Manage →
            </Link>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className={styles.skeletonBlock} style={{ height: "1.1rem", width: "30%" }} />
                  <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "20%" }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {roles.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontFamily: "Inter", fontSize: "0.9rem" }}>{roleBadge(r.id, roles, styles)}</span>
                  <span style={{ color: "rgba(249,249,249,0.6)", fontFamily: "Inter", fontSize: "0.88rem" }}>
                    {countByRole[r.id] ?? 0} member{(countByRole[r.id] ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
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
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
              No open items
            </div>
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
