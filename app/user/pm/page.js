"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

export default function PMDashboard() {
  const { data: session, status } = useSession();
  const [myRecord, setMyRecord] = useState(null);
  const [students, setStudents] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintCompletions, setSprintCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const netID = session?.user?.netID;
  const base = "/user/pm";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, itemsRes, spRes] = await Promise.all([
      fetch("/api/users/me"),
      fetch("/api/action_items"),
      fetch("/api/sprints"),
    ]);
    let me = null;
    if (meRes.ok) { me = await meRes.json(); setMyRecord(me); }
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    if (spRes.ok) {
      const spData = await spRes.json();
      const today = new Date().toISOString().slice(0, 10);
      const cur = spData.find((s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date) || spData[0] || null;
      setCurrentSprint(cur);
      if (cur) {
        const compRes = await fetch(`/api/sprints/${cur.id}/completions`);
        if (compRes.ok) setSprintCompletions(await compRes.json());
      }
    }
    if (me?.group_number) {
      const stuRes = await fetch(`/api/users?role=STUDENT&group=${me.group_number}`);
      if (stuRes.ok) setStudents(await stuRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const groupNumber = myRecord?.group_number;
  const openItems = actionItems.filter((a) => !a.is_done);
  const completedInGroup = sprintCompletions.filter((c) =>
    students.some((s) => s.net_id === c.student_net_id)
  ).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>PM Dashboard</h1>
        <p>
          {session?.user?.name || netID}
          {groupNumber ? ` · Group ${groupNumber}` : " · No group assigned"}
        </p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : [
              { label: "My Students", val: students.length },
              { label: "Open Items", val: openItems.length },
              { label: "My Group", val: groupNumber ?? "-" },
            ].map(({ label, val }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNumber}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))
        }
      </div>

      {/* Current sprint card */}
      {!loading && currentSprint && (
        <div className={styles.panel} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ color: "rgba(249,249,249,0.45)", fontFamily: "Inter", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                Sprint {currentSprint.number}
              </div>
              <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600, fontSize: "1rem" }}>
                {currentSprint.goal}
              </div>
              {(currentSprint.start_date || currentSprint.end_date) && (
                <div style={{ color: "rgba(249,249,249,0.4)", fontFamily: "Inter", fontSize: "0.78rem", marginTop: "0.3rem" }}>
                  {currentSprint.start_date && new Date(currentSprint.start_date + "T00:00:00").toLocaleDateString()}
                  {currentSprint.start_date && currentSprint.end_date && " - "}
                  {currentSprint.end_date && new Date(currentSprint.end_date + "T00:00:00").toLocaleDateString()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.4rem 0.75rem" }}>
              <span style={{ color: "#4ade80", fontFamily: "Inter", fontWeight: 700, fontSize: "1rem" }}>
                {completedInGroup}
              </span>
              <span style={{ color: "rgba(249,249,249,0.5)", fontFamily: "Inter", fontSize: "0.85rem" }}>
                / {students.length} complete
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.twoCol}>
        {/* Students preview */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>My Students</span>
            <Link href={`${base}/students`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}><tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "65%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "30%" }} /></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ) : students.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
              No students assigned yet
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Open Items</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((u) => {
                    const open = actionItems.filter((a) => a.net_id === u.net_id && !a.is_done).length;
                    return (
                      <tr key={u.net_id}>
                        <td>
                          <div>{u.name || <span style={{ opacity: 0.4 }}>-</span>}</div>
                          <div className={styles.cellMono} style={{ fontSize: "0.78rem", opacity: 0.55 }}>{u.net_id}</div>
                        </td>
                        <td>
                          <span style={{ color: open > 0 ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>{open}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action items preview */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Pending Action Items</span>
            <Link href={`${base}/action_items`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className={styles.actionList}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.actionCard}>
                  <div className={styles.actionBody}>
                    <div className={styles.skeletonBlock} style={{ height: "0.9rem", width: "80%", marginBottom: "0.4rem" }} />
                    <div className={styles.skeletonBlock} style={{ height: "0.7rem", width: "45%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : openItems.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
              No pending items
            </div>
          ) : (
            <div className={styles.actionList}>
              {openItems.slice(0, 5).map((item) => (
                <div key={item.id} className={styles.actionCard}>
                  <div className={styles.actionBody}>
                    <div className={styles.actionTitle}>{item.title}</div>
                    <div className={styles.actionMeta}>
                      <span className={styles.actionMetaItem}>{item.net_id}</span>
                      {item.due_date && (
                        <span className={styles.actionMetaItem}>
                          Due {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {openItems.length > 5 && (
                <div style={{ padding: "0.5rem 0.25rem", color: "rgba(249,249,249,0.35)", fontSize: "0.8rem", fontFamily: "Inter" }}>
                  +{openItems.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
