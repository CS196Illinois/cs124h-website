"use client";

import styles from "../dashboard.module.css";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import { averagePct, itemPct } from "../../../lib/grading";
import { downloadCsv } from "../../../lib/csvExport";

/**
 * Full grade history for one student - every gradable action item they've
 * ever been assigned, regardless of which assignment or group view was used
 * to open it. This is the one "view all of this student's grades" surface
 * both the group-overview and by-assignment tabs link into.
 */
export default function StudentGradesModal({ student, items, onClose }) {
  const mine = items
    .filter((i) => i.net_id === student.net_id && i.is_gradable)
    .sort((a, b) => new Date(b.due_date || b.created_at) - new Date(a.due_date || a.created_at));
  const avg = averagePct(mine);
  const gradedCount = mine.filter((i) => i.grade != null).length;

  const exportCsv = () => {
    downloadCsv(
      `${student.net_id}-grades-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "title", label: "Assignment" },
        { key: "due_date", label: "Due Date", value: (i) => (i.due_date ? new Date(i.due_date).toLocaleDateString() : "") },
        { key: "grade", label: "Grade", value: (i) => i.grade ?? "" },
        { key: "max_score", label: "Max Score", value: (i) => i.max_score ?? "" },
        { key: "percent", label: "Percent", value: (i) => { const p = itemPct(i); return p != null ? p.toFixed(1) : ""; } },
        { key: "status", label: "Status", value: (i) => (i.grade != null ? "Graded" : i.is_done ? "Ready to Grade" : "Pending") },
      ],
      mine,
    );
  };

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <h2>{student.name || student.net_id}</h2>
      <p style={{ color: "rgba(249,249,249,0.5)", fontFamily: "Inter, sans-serif", fontSize: "0.85rem", marginTop: "-0.75rem", marginBottom: "1.25rem" }}>
        <span className={styles.cellMono}>{student.net_id}</span>
        {student.group_number != null && ` · Group ${student.group_number}`}
      </p>

      <div className={styles.statsGrid} style={{ marginBottom: "1.25rem" }}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{avg != null ? `${avg.toFixed(1)}%` : "—"}</div>
          <div className={styles.statLabel}>Average</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{gradedCount}/{mine.length}</div>
          <div className={styles.statLabel}>Graded</div>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📊</span>No gradable assignments yet.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr><th>Assignment</th><th>Due</th><th>Status</th><th>%</th></tr>
            </thead>
            <tbody>
              {mine.map((i) => {
                const pct = itemPct(i);
                return (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td style={{ color: "rgba(249,249,249,0.55)" }}>{i.due_date ? new Date(i.due_date).toLocaleDateString() : "—"}</td>
                    <td><StatusBadge item={i} /></td>
                    <td style={{ fontWeight: 600 }}>{pct != null ? `${pct.toFixed(1)}%` : <span style={{ opacity: 0.3 }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.modalActions}>
        <button className={styles.btnSecondary} onClick={exportCsv} disabled={mine.length === 0}>
          Export CSV
        </button>
        <button className={styles.btnPrimary} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
