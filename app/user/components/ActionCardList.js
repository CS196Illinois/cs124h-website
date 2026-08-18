"use client";

import styles from "../dashboard.module.css";
import { gradingStatus, formatGrade } from "../../../lib/grading";

export default function ActionCardList({ items, onToggle }) {
  return (
    <div className={styles.actionList}>
      {items.map((item) => {
        const status = gradingStatus(item);
        return (
          <div key={item.id} className={`${styles.actionCard} ${item.is_done ? styles.done : ""}`}>
            <button
              className={`${styles.actionCheckbox} ${item.is_done ? styles.checked : ""}`}
              onClick={() => onToggle(item.id, item.is_done)}
              aria-label={item.is_done ? "Mark incomplete" : "Mark complete"}
            >
              {item.is_done && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className={styles.actionBody}>
              <div className={`${styles.actionTitle} ${item.is_done ? styles.strikethrough : ""}`}>
                {item.title}
                {status === "pending" && (
                  <span style={{ marginLeft: "0.5rem", color: "#ecb557", fontSize: "0.7rem", fontWeight: 600, verticalAlign: "middle" }}>
                    GRADABLE
                  </span>
                )}
              </div>
              {item.description && <div className={styles.actionDesc}>{item.description}</div>}
              <div className={styles.actionMeta}>
                {item.due_date && (
                  <span className={styles.actionMetaItem}>Due {new Date(item.due_date).toLocaleDateString()}</span>
                )}
                {item.completion_date && item.is_done && (
                  <span className={styles.actionMetaItem}>Completed {new Date(item.completion_date).toLocaleDateString()}</span>
                )}
                {(item.assigned_by || item.additional_info?.assigned_by) && (
                  <span className={styles.actionMetaItem}>
                    Assigned by {item.assigned_by || item.additional_info.assigned_by}
                  </span>
                )}
                {status === "ready_to_grade" && (
                  <span className={styles.actionMetaItem} style={{ color: "#ecb557" }}>Awaiting grade</span>
                )}
                {status === "graded" && (
                  <span className={styles.actionMetaItem} style={{ color: "#4f8dde" }}>Score: {formatGrade(item)}</span>
                )}
              </div>
              {status === "graded" && item.grade_note && (
                <div className={styles.actionDesc} style={{ marginTop: "0.35rem", fontStyle: "italic" }}>
                  “{item.grade_note}”
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
