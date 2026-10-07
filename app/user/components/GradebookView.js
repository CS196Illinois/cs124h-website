"use client";

import { useState } from "react";
import styles from "../dashboard.module.css";
import GradebookGroups from "./GradebookGroups";
import GradebookAssignments from "./GradebookAssignments";
import { buildAssignments, groupAveragePct } from "../../../lib/grading";

/**
 * Top-level gradebook: a "By Group" (flat when `groupBy` is false, i.e. a PM
 * already scoped to one group) view of student averages that drill down into
 * a student's full grade history, plus a "By Assignment" view doing the same
 * drill-down one assignment at a time.
 */
export default function GradebookView({ students, items, groupBy = false, emptyMessage = "No understanding checks submitted yet." }) {
  const [tab, setTab] = useState("overview");

  if (students.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📊</span>No students in scope yet
      </div>
    );
  }

  const studentNetIds = new Set(students.map((s) => s.net_id));
  const relevant = items.filter((i) => i.is_gradable && studentNetIds.has(i.net_id));

  if (relevant.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📊</span>{emptyMessage}
      </div>
    );
  }

  const assignments = buildAssignments(relevant);
  const overallAvg = groupAveragePct(students, relevant);

  return (
    <div>
      <div className={`${styles.statsGrid} ${styles.gradebookStats}`}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{students.length}</div>
          <div className={styles.statLabel}>{groupBy ? "Students" : "Group Size"}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{assignments.length}</div>
          <div className={styles.statLabel}>Assignments</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{overallAvg != null ? `${overallAvg.toFixed(1)}%` : "—"}</div>
          <div className={styles.statLabel}>{groupBy ? "Course Average" : "Group Average"}</div>
        </div>
      </div>

      <details className={styles.gradebookHint}>
        <summary>How averages are calculated</summary>
        <p>Averages include graded assignments only. Each assignment counts equally in a student’s average; each graded student counts equally in group and course averages.</p>
      </details>

      <div className={styles.tabs}>
        <button aria-pressed={tab === "overview"} className={`${styles.tab} ${tab === "overview" ? styles.activeTab : ""}`} onClick={() => setTab("overview")}>
          {groupBy ? "By Group" : "Students"}
        </button>
        <button aria-pressed={tab === "assignments"} className={`${styles.tab} ${tab === "assignments" ? styles.activeTab : ""}`} onClick={() => setTab("assignments")}>
          By Assignment
        </button>
      </div>

      {tab === "overview" ? (
        <GradebookGroups students={students} items={relevant} groupBy={groupBy} />
      ) : (
        <GradebookAssignments students={students} items={relevant} groupBy={groupBy} />
      )}
    </div>
  );
}
