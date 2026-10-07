"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";
import { getCurrentSprint } from "../../../lib/sprintVisibility";

/** Loads the sprint running today and its completions, for dashboard sprint cards. */
export async function loadCurrentSprint() {
  const res = await fetch("/api/sprints");
  if (!res.ok) return { sprint: null, completions: [] };
  const sprint = getCurrentSprint(await res.json());
  if (!sprint) return { sprint: null, completions: [] };
  const compRes = await fetch(`/api/sprints/${sprint.id}/completions`);
  return { sprint, completions: compRes.ok ? await compRes.json() : [] };
}

/** Row of headline numbers; shows `skeletonCount` placeholders while loading. */
export function StatGrid({ loading, stats, skeletonCount = stats.length }) {
  return (
    <div className={styles.statsGrid}>
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className={styles.statCard}>
              <div className={`${styles.skeletonBlock} ${styles.skeletonStatNumber}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonStatLabel}`} />
            </div>
          ))
        : stats.map(({ label, val }) => (
            <div key={label} className={styles.statCard}>
              <div className={styles.statNumber}>{val}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
    </div>
  );
}

/** Panel title with an optional count badge and a link to the full page. */
export function PanelHeader({ title, count, href, linkLabel = "View all →" }) {
  return (
    <div className={styles.panelHeader}>
      <span className={styles.panelTitle}>
        {title}
        {count > 0 && <span className={styles.countBadge}>{count}</span>}
      </span>
      {href && <Link href={href} className={styles.panelLink}>{linkLabel}</Link>}
    </div>
  );
}

/** Current sprint's number, goal, and dates, with role-specific status on the right. */
export function SprintCard({ sprint, children }) {
  const date = (value) => new Date(value + "T00:00:00").toLocaleDateString();
  return (
    <div className={`${styles.panel} ${styles.sprintCard}`}>
      <div>
        <div className={styles.sprintEyebrow}>Sprint {sprint.number}</div>
        <div className={styles.sprintGoal}>{sprint.goal}</div>
        {(sprint.start_date || sprint.end_date) && (
          <div className={styles.sprintDates}>
            {sprint.start_date && date(sprint.start_date)}
            {sprint.start_date && sprint.end_date && " - "}
            {sprint.end_date && date(sprint.end_date)}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** "N / total complete" chip for a group's sprint progress. */
export function CompletionChip({ done, total }) {
  return (
    <div className={styles.completionChip}>
      <span className={styles.completionCount}>{done}</span>
      <span className={styles.completionTotal}>/ {total} complete</span>
    </div>
  );
}

/** Name/NetID table of a PM's group, linking to the full roster. */
export function StudentsPreview({ loading, students, href }) {
  return (
    <div className={styles.panel}>
      <PanelHeader title="My Students" href={href} />
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
        <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>No students assigned yet</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>NetID</th>
              </tr>
            </thead>
            <tbody>
              {students.map((u) => (
                <tr key={u.net_id}>
                  <td>{u.name || <span className={styles.muted}>-</span>}</td>
                  <td className={styles.cellMono}>{u.net_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Dashboard for a group's PM (and a web dev assigned to a group): their
 * students and the current sprint's completion. `aside` renders beside the
 * roster.
 */
export function GroupDashboard({ title, rosterHref, aside }) {
  const { data: session, status } = useSession();
  const [myRecord, setMyRecord] = useState(null);
  const [students, setStudents] = useState([]);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintCompletions, setSprintCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, current] = await Promise.all([fetch("/api/users/me"), loadCurrentSprint()]);
    const me = meRes.ok ? await meRes.json() : null;
    setMyRecord(me);
    setCurrentSprint(current.sprint);
    setSprintCompletions(current.completions);
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
  const completedInGroup = sprintCompletions.filter((c) => students.some((s) => s.net_id === c.student_net_id)).length;
  const roster = <StudentsPreview loading={loading} students={students} href={rosterHref} />;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{title}</h1>
        <p>
          {session?.user?.name || session?.user?.netID}
          {groupNumber ? ` · Group ${groupNumber}` : " · No group assigned"}
        </p>
      </div>

      <StatGrid loading={loading} stats={[
        { label: "My Students", val: students.length },
        { label: "My Group", val: groupNumber ?? "-" },
      ]} />

      {!loading && currentSprint && (
        <SprintCard sprint={currentSprint}>
          <CompletionChip done={completedInGroup} total={students.length} />
        </SprintCard>
      )}

      {aside ? (
        <div className={`${styles.twoCol} ${styles.alignStart}`}>
          {roster}
          {aside}
        </div>
      ) : roster}
    </div>
  );
}
