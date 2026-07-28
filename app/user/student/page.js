"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const [actionItems, setActionItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [checkedIn, setCheckedIn] = useState(new Set());
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintCompletions, setSprintCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = "/user/student";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, eventsRes, attendRes, spRes] = await Promise.all([
      fetch("/api/action_items"),
      fetch("/api/events"),
      fetch("/api/events/my-checkins"),
      fetch("/api/sprints"),
    ]);
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    if (eventsRes.ok) setEvents(await eventsRes.json());
    if (attendRes.ok) {
      const data = await attendRes.json();
      setCheckedIn(new Set(data.map((r) => r.event_id)));
    }
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
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const todo = actionItems.filter((a) => !a.is_done);
  const done = actionItems.filter((a) => a.is_done);
  const openEvents = events.filter((e) => e.check_in_open && !checkedIn.has(e.id));
  const myNetId = session?.user?.netID;
  const sprintDone = sprintCompletions.some((c) => c.student_net_id === myNetId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Dashboard</h1>
        <p>{session?.user?.name || session?.user?.netID}</p>
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
              { label: "To Do", val: todo.length },
              { label: "Completed", val: done.length },
              { label: "Events Attended", val: checkedIn.size },
            ].map(({ label, val }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNumber}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))
        }
      </div>

      {/* Open check-in alert */}
      {openEvents.length > 0 && (
        <div style={{
          background: "rgba(74, 222, 128, 0.1)",
          border: "1px solid rgba(74, 222, 128, 0.3)",
          borderRadius: "10px",
          padding: "0.85rem 1.25rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}>
          <span style={{ color: "#4ade80", fontFamily: "Inter", fontSize: "0.9rem", fontWeight: 600 }}>
            Check-in is open for {openEvents.length} event{openEvents.length !== 1 ? "s" : ""}
          </span>
          <Link href={`${base}/attendance`} style={{ color: "#4ade80", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none", fontWeight: 600 }}>
            Check in now →
          </Link>
        </div>
      )}

      {/* Current sprint card */}
      {!loading && currentSprint && (
        <div className={styles.panel} style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
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
                {currentSprint.start_date && currentSprint.end_date && " — "}
                {currentSprint.end_date && new Date(currentSprint.end_date + "T00:00:00").toLocaleDateString()}
              </div>
            )}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: sprintDone ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
            border: sprintDone ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "0.5rem 1rem",
          }}>
            <span className={`${styles.statusDot} ${sprintDone ? styles.statusDoneDot : styles.statusPendingDot}`} />
            <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: "0.9rem", color: sprintDone ? "#4ade80" : "rgba(249,249,249,0.6)" }}>
              {sprintDone ? "Sprint Complete" : "In Progress"}
            </span>
          </div>
        </div>
      )}

      <div className={styles.twoCol}>
        {/* Pending action items */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>
              Pending Action Items
              {todo.length > 0 && (
                <span style={{ background: "#ecb557", color: "#112a67", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.72rem", marginLeft: "0.5rem", fontWeight: 700 }}>
                  {todo.length}
                </span>
              )}
            </span>
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
          ) : todo.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
              You're all caught up!
            </div>
          ) : (
            <div className={styles.actionList}>
              {todo.slice(0, 5).map((item) => (
                <div key={item.id} className={styles.actionCard}>
                  <div className={styles.actionBody}>
                    <div className={styles.actionTitle}>{item.title}</div>
                    <div className={styles.actionMeta}>
                      {item.due_date && (
                        <span className={styles.actionMetaItem}>
                          Due {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {item.additional_info?.assigned_by && (
                        <span className={styles.actionMetaItem}>
                          From {item.additional_info.assigned_by}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {todo.length > 5 && (
                <div style={{ padding: "0.5rem 0.25rem", color: "rgba(249,249,249,0.35)", fontSize: "0.8rem", fontFamily: "Inter" }}>
                  +{todo.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Completed items */}
        <div className={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Recently Completed</span>
            <Link href={`${base}/action_items`} style={{ color: "#ecb557", fontSize: "0.82rem", fontFamily: "Inter", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div className={styles.actionList}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.actionCard}>
                  <div className={styles.actionBody}>
                    <div className={styles.skeletonBlock} style={{ height: "0.9rem", width: "75%", marginBottom: "0.4rem" }} />
                    <div className={styles.skeletonBlock} style={{ height: "0.7rem", width: "35%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : done.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
              No completed items yet
            </div>
          ) : (
            <div className={styles.actionList}>
              {done.slice(0, 5).map((item) => (
                <div key={item.id} className={`${styles.actionCard} ${styles.done}`}>
                  <div className={styles.actionBody}>
                    <div className={`${styles.actionTitle} ${styles.strikethrough}`}>{item.title}</div>
                    <div className={styles.actionMeta}>
                      {item.completion_date && (
                        <span className={styles.actionMetaItem}>
                          Completed {new Date(item.completion_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {done.length > 5 && (
                <div style={{ padding: "0.5rem 0.25rem", color: "rgba(249,249,249,0.35)", fontSize: "0.8rem", fontFamily: "Inter" }}>
                  +{done.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
