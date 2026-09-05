"use client";

import { useState } from "react";
import Modal from "./Modal";
import styles from "../dashboard.module.css";

export default function GradeActionItemModal({ item, onClose, onSaved }) {
  const [grade, setGrade] = useState(item.grade != null ? String(item.grade) : "");
  const [note, setNote] = useState(item.grade_note || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (rawGrade) => {
    setError("");
    let gradeValue = null;
    if (rawGrade !== null) {
      const g = Number(rawGrade);
      if (rawGrade.trim() === "" || Number.isNaN(g) || g < 0) {
        setError("Enter a valid, non-negative grade.");
        return;
      }
      if (item.max_score != null && g > item.max_score) {
        setError(`Grade cannot exceed ${item.max_score}.`);
        return;
      }
      gradeValue = g;
    }
    setLoading(true);
    const res = await fetch(`/api/action_items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: gradeValue, grade_note: note.trim() || null }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to save grade."); setLoading(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2>Grade Item</h2>
      <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", marginTop: "-0.6rem", marginBottom: "1.1rem" }}>
        {item.title} · <span style={{ fontFamily: "monospace" }}>{item.net_id}</span>
      </p>
      {error && <div className={styles.alertError}>{error}</div>}
      <div className={styles.formGroup}>
        <label>Grade <span className={styles.required}>*</span>{item.max_score != null ? ` (out of ${item.max_score})` : ""}</label>
        <input
          type="number"
          min="0"
          max={item.max_score ?? undefined}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="e.g. 92"
        />
      </div>
      <div className={styles.formGroup}>
        <label>Feedback</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional feedback…" />
      </div>
      <div className={styles.modalActions}>
        {item.grade != null && (
          <button className={styles.btnDanger} onClick={() => submit(null)} disabled={loading} style={{ marginRight: "auto" }}>
            Clear Grade
          </button>
        )}
        <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancel</button>
        <button className={styles.btnPrimary} onClick={() => submit(grade)} disabled={loading}>
          {loading ? "Saving…" : "Save Grade"}
        </button>
      </div>
    </Modal>
  );
}
