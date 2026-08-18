"use client";

import styles from "../dashboard.module.css";
import StatusBadge from "./StatusBadge";
import { gradingStatus } from "../../../lib/grading";

export default function ActionItemRow({ item, myNetId, onToggle, onEdit, onDelete, onGrade }) {
  const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
  const canGrade = onGrade && assignedBy === myNetId && item.is_gradable && item.is_done;
  const status = gradingStatus(item);

  return (
    <tr>
      <td>{item.title}</td>
      <td style={{ color: "rgba(249,249,249,0.5)", fontSize: "0.82rem", fontFamily: "monospace" }}>
        {assignedBy || "-"}
        {assignedBy === myNetId && (
          <span style={{ marginLeft: "0.35rem", color: "#4f8dde", fontSize: "0.72rem" }}>(you)</span>
        )}
      </td>
      <td style={{ color: "rgba(249,249,249,0.6)", fontSize: "0.85rem" }}>
        {item.due_date ? new Date(item.due_date).toLocaleDateString() : "-"}
      </td>
      <td><StatusBadge item={item} /></td>
      <td>
        <div className={styles.cellActions}>
          <button
            className={`${styles.btnSmall} ${item.is_done ? styles.btnReopen : styles.btnComplete}`}
            onClick={() => onToggle(item.id, item.is_done)}
          >
            {item.is_done ? "Reopen" : "Complete"}
          </button>
          {canGrade && (
            <button
              className={styles.btnSmall}
              style={{ background: "rgba(236,181,87,0.15)", color: "#ecb557", border: "1px solid rgba(236,181,87,0.25)" }}
              onClick={() => onGrade(item)}
            >
              {status === "graded" ? "Edit Grade" : "Grade"}
            </button>
          )}
          <button
            className={styles.btnSmall}
            style={{ background: "rgba(79,141,222,0.15)", color: "#4f8dde", border: "1px solid rgba(79,141,222,0.25)" }}
            onClick={() => onEdit(item)}
          >
            Edit
          </button>
          <button className={styles.btnDanger} onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}
