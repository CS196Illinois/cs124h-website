"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

export default function LeadWebDevDashboard() {
  const { data: session, status } = useSession();
  const [webDevs, setWebDevs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/lead_web_dev";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [devsRes, reqRes, itemsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/role-view-requests"),
      fetch("/api/action_items"),
    ]);
    if (devsRes.ok) setWebDevs(await devsRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  const webDevOnly = webDevs.filter((u) => u.role === "WEB");
  const leadWebDevs = webDevs.filter((u) => u.role === "LEAD_WEB");
  const teamMembers = webDevs.filter((u) => u.role === "WEB" || u.role === "LEAD_WEB");
  const pending = requests.filter((r) => r.status === "pending");
  const openItems = actionItems.filter((a) => !a.is_done);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lead Web Dev Dashboard</h1>
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
              { label: "Web Devs", val: webDevOnly.length },
              { label: "Lead Web Devs", val: leadWebDevs.length },
              { label: "Pending Requests", val: pending.length },
              { label: "Open Items", val: openItems.length },
            ].map(({ label, val }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNumber}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))
        }
      </div>

      <div className={styles.threeCol} style={{ marginBottom: "1rem" }}>
        {[
          { path: "/user/course_lead", label: "Course Lead" },
          { path: "/user/head_pm",     label: "Head PM" },
          { path: "/user/pm",          label: "PM" },
          { path: "/user/web_dev",     label: "Web Dev" },
          { path: "/user/student",     label: "Student" },
        ].map(({ path, label }) => (
          <Link key={path} href={path} style={{ textDecoration: "none" }}>
            <div className={styles.panel} style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontSize: "0.88rem", fontWeight: 600 }}>{label}</span>
              <span style={{ color: "#ecb557", fontSize: "0.8rem", fontFamily: "Inter" }}>View →</span>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.twoCol}>
        {/* Pending role-view requests */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>
              Role View Requests
              {pending.length > 0 && (
                <span style={{ background: "#ecb557", color: "#112a67", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.72rem", marginLeft: "0.5rem", fontWeight: 700 }}>
                  {pending.length}
                </span>
              )}
            </span>
            <Link href={`${base}/role_requests`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "60%", marginBottom: "0.3rem" }} />
                  <div className={styles.skeletonBlock} style={{ height: "0.7rem", width: "40%" }} />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>No pending requests</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {pending.slice(0, 5).map((req) => (
                <div key={req.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontSize: "0.85rem" }}>{req.requester_net_id}</div>
                    <div style={{ color: "rgba(249,249,249,0.45)", fontFamily: "Inter", fontSize: "0.76rem" }}>
                      Requesting: {req.requested_role}
                    </div>
                  </div>
                  <Link href={`${base}/role_requests`} style={{ color: "#ecb557", fontSize: "0.78rem", fontFamily: "Inter", textDecoration: "none" }}>Review →</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Web Dev team */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Web Dev Team</span>
            <Link href={`${base}/people`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              Manage →
            </Link>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "55%" }} />
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>No web devs yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {teamMembers.slice(0, 6).map((u) => (
                <div key={u.net_id} style={{ padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontSize: "0.85rem" }}>{u.name || u.net_id}</span>
                  <span className={`${styles.badge} ${u.role === "LEAD_WEB" ? styles.badgeLEAD : styles.badgeWEB}`}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
