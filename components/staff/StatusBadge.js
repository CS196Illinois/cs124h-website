"use client";

import styles from "./dashboard.module.css";
import { gradingStatus, formatGrade } from "../../lib/grading";

export default function StatusBadge({ item }) {
  const status = gradingStatus(item);

  if (status === "ready_to_grade") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--link)", fontWeight: 600, fontSize: "0.85rem" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary-bg)" }} />
        Ready to Grade
      </span>
    );
  }

  if (status === "graded") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--link)", fontWeight: 600, fontSize: "0.85rem" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--link)" }} />
        Graded {formatGrade(item)}
      </span>
    );
  }

  return item.is_done
    ? <span className={styles.statusDone}><span className={`${styles.statusDot} ${styles.statusDoneDot}`} />Done</span>
    : <span className={styles.statusPending}><span className={`${styles.statusDot} ${styles.statusPendingDot}`} />Pending</span>;
}
