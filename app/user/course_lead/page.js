"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../dashboard.module.css";
import { StatGrid, PanelHeader } from "../components/DashboardParts";

function roleBadge(roleId, roles, s) {
  const def = roles.find((r) => r.id === roleId);
  return <span className={`${s.badge} ${def ? s[def.badgeClass] : ""}`}>{roleId}</span>;
}

export default function CourseLeadDashboard() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/course_lead";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const countByRole = Object.fromEntries(roles.map((r) => [r.id, users.filter((u) => u.role === r.id).length]));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Course Lead Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <StatGrid loading={loading} skeletonCount={5} stats={[
        ...roles.map((r) => ({ label: `${r.label}s`, val: countByRole[r.id] ?? 0 })),
      ]} />

      {/* People overview */}
      <div className={styles.panel}>
        <PanelHeader title="Team Overview" href={`${base}/people`} linkLabel="Manage →" />
        {loading ? (
          <div className={styles.listStack}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.listRow}>
                <div className={styles.skeletonBlock} style={{ height: "1.1rem", width: "30%" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "20%" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.listStack}>
            {roles.map((r) => (
              <div key={r.id} className={styles.listRow}>
                {roleBadge(r.id, roles, styles)}
                <span className={styles.listSecondary}>
                  {countByRole[r.id] ?? 0} member{(countByRole[r.id] ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
