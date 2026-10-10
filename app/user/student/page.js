"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";
import { StatGrid, SprintCard, loadCurrentSprint } from "../components/DashboardParts";

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState([]);
  const [checkedIn, setCheckedIn] = useState(new Set());
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintCompletions, setSprintCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [eventsRes, attendRes, current] = await Promise.all([
      fetch("/api/events?scope=checkin"),
      fetch("/api/events/my-checkins"),
      loadCurrentSprint(),
    ]);
    if (eventsRes.ok) setEvents(await eventsRes.json());
    if (attendRes.ok) setCheckedIn(new Set((await attendRes.json()).map((r) => r.event_id)));
    setCurrentSprint(current.sprint);
    setSprintCompletions(current.completions);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const openEvents = events.filter((e) => e.check_in_open && !checkedIn.has(e.id));
  const sprintDone = sprintCompletions.some((c) => c.student_net_id === session?.user?.netID);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Dashboard</h1>
        <p>{session?.user?.name || session?.user?.netID}</p>
      </div>

      <StatGrid loading={loading} stats={[
        { label: "Open Check-ins", val: openEvents.length },
        { label: "Events Attended", val: checkedIn.size },
      ]} />

      {openEvents.length > 0 && (
        <div className={styles.checkinAlert}>
          <span>Check-in is open for {openEvents.length} event{openEvents.length !== 1 ? "s" : ""}</span>
          <Link href="/user/student/attendance">Check in now →</Link>
        </div>
      )}

      {!loading && currentSprint && (
        <SprintCard sprint={currentSprint}>
          <div className={`${styles.sprintStatus} ${sprintDone ? styles.sprintStatusDone : ""}`}>
            <span className={`${styles.statusDot} ${sprintDone ? styles.statusDoneDot : styles.statusPendingDot}`} />
            <span>{sprintDone ? "Sprint Complete" : "In Progress"}</span>
          </div>
        </SprintCard>
      )}
    </div>
  );
}
