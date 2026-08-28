"use client";

import styles from "../dashboard.module.css";
import StatusBadge from "./StatusBadge";
import { gradingStatus } from "../../../lib/grading";

export default function ActionItemRow({ item, myNetId, onToggle, onEdit, onDelete, onGrade, onDeleteBatch, allItems }) {
  const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
  const canGrade = onGrade && assignedBy === myNetId && item.is_gradable && item.is_done;
  const status = gradingStatus(item);
  // Items assigned to more than one recipient at once share a batch_id
  // (see app/api/action_items/route.js). Offer to delete the whole batch
  // in one shot from any of its per-recipient rows, not just from the
  // "Needs Grading" view where this was previously the only place it lived.
  const batchItems = item.batch_id && allItems ? allItems.filter((i) => i.batch_id === item.batch_id) : null;

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
          {batchItems && batchItems.length > 1 && onDeleteBatch && (
            <button
              className={styles.btnDanger}
              title={`Delete this item for all ${batchItems.length} recipients it was assigned to`}
              onClick={() => onDeleteBatch(item.batch_id, batchItems)}
            >
              Delete Batch ({batchItems.length})
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
