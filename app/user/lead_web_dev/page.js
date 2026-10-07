"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";
import SandboxPanel from "../components/SandboxPanel";
import { StatGrid, PanelHeader } from "../components/DashboardParts";

const ROLE_DASHBOARDS = [
  { path: "/user/course_lead", label: "Course Lead" },
  { path: "/user/head_pm",     label: "Head PM" },
  { path: "/user/pm",          label: "PM" },
  { path: "/user/web_dev",     label: "Web Dev" },
  { path: "/user/student",     label: "Student" },
];

export default function LeadWebDevDashboard() {
  const { data: session, status } = useSession();
  const [webDevs, setWebDevs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/lead_web_dev";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [devsRes, reqRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/role-view-requests"),
    ]);
    if (devsRes.ok) setWebDevs(await devsRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  const webDevOnly = webDevs.filter((u) => u.role === "WEB");
  const leadWebDevs = webDevs.filter((u) => u.role === "LEAD_WEB");
  const teamMembers = webDevs.filter((u) => u.role === "WEB" || u.role === "LEAD_WEB");
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lead Web Dev Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <StatGrid loading={loading} skeletonCount={3} stats={[
        { label: "Web Devs", val: webDevOnly.length },
        { label: "Lead Web Devs", val: leadWebDevs.length },
        { label: "Pending Requests", val: pending.length },
      ]} />

      <div className={`${styles.threeCol} ${styles.sectionGap}`}>
        {ROLE_DASHBOARDS.map(({ path, label }) => (
          <Link key={path} href={path} className={`${styles.panel} ${styles.roleShortcut}`}>
            <span>{label}</span>
            <span className={styles.roleShortcutAction}>View →</span>
          </Link>
        ))}
      </div>

      <div className={styles.threeCol}>
        <div className={styles.panel}>
          <PanelHeader title="Role View Requests" count={pending.length} href={`${base}/role_requests`} />
          {loading ? (
            <div className={styles.listStack}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.listRow}>
                  <div style={{ width: "100%" }}>
                    <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "60%", marginBottom: "0.3rem" }} />
                    <div className={styles.skeletonBlock} style={{ height: "0.7rem", width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>No pending requests</div>
          ) : (
            <div className={styles.listStack}>
              {pending.slice(0, 5).map((req) => (
                <div key={req.id} className={styles.listRow}>
                  <div>
                    <div className={styles.listPrimary}>{req.requester_net_id}</div>
                    <div className={styles.listSecondary}>Requesting: {req.requested_role}</div>
                  </div>
                  <Link href={`${base}/role_requests`} className={styles.panelLink}>Review →</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <PanelHeader title="Web Dev Team" href={`${base}/people`} linkLabel="Manage →" />
          {loading ? (
            <div className={styles.listStack}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.listRow}>
                  <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "55%" }} />
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>No web devs yet</div>
          ) : (
            <div className={styles.listStack}>
              {teamMembers.slice(0, 6).map((u) => (
                <div key={u.net_id} className={styles.listRow}>
                  <span className={styles.listPrimary}>{u.name || u.net_id}</span>
                  <span className={`${styles.badge} ${u.role === "LEAD_WEB" ? styles.badgeLEAD : styles.badgeWEB}`}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <SandboxPanel />
      </div>
    </div>
  );
}
