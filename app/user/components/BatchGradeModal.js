"use client";

import { useState } from "react";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import styles from "../dashboard.module.css";

/**
 * Grades every item in a bulk-assigned batch from one screen, instead of
 * forcing the assigner to open N individual grade modals.
 */
export default function BatchGradeModal({ batchId, items, peopleByNetId, onClose, onSaved }) {
  const [grades, setGrades] = useState(
    Object.fromEntries(items.map((i) => [i.id, i.grade != null ? String(i.grade) : ""]))
  );
  const [note, setNote] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxScore = items[0]?.max_score ?? null;
  const title = items[0]?.title ?? "Batch";
  const doneItems = items.filter((i) => i.is_done);
  const gradedCount = items.filter((i) => i.grade != null).length;

  const applyToAll = () => {
    if (bulkValue.trim() === "") return;
    setGrades((g) => {
      const next = { ...g };
      for (const item of doneItems) next[item.id] = bulkValue;
      return next;
    });
  };

  const handleSave = async () => {
    setError("");
    const entries = [];
    for (const item of items) {
      if (!item.is_done) continue;
      const raw = grades[item.id];
      if (raw === "" || raw == null) { entries.push({ id: item.id, grade: null }); continue; }
      const g = Number(raw);
      if (!Number.isFinite(g) || g < 0) { setError(`Invalid grade for ${item.net_id}.`); return; }
      if (maxScore != null && g > maxScore) { setError(`Grade for ${item.net_id} cannot exceed ${maxScore}.`); return; }
      entries.push({ id: item.id, grade: g, grade_note: note.trim() || undefined });
    }
    if (entries.length === 0) { setError("No completed items to grade yet."); return; }

    setLoading(true);
    const res = await fetch(`/api/action_items/batch/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades: entries }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to save grades."); setLoading(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <h2>Grade Batch</h2>
      <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.82rem", fontFamily: "Inter, sans-serif", marginTop: "-0.6rem", marginBottom: "1.1rem" }}>
        {title} · {items.length} people · {doneItems.length} completed · {gradedCount} graded
      </p>
      {error && <div className={styles.alertError}>{error}</div>}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", marginBottom: "1rem" }}>
        <div className={styles.formGroup} style={{ marginBottom: 0, flex: 1 }}>
          <label>Apply one score to everyone completed{maxScore != null ? ` (out of ${maxScore})` : ""}</label>
          <input type="number" min="0" max={maxScore ?? undefined} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="e.g. 92" />
        </div>
        <button type="button" className={styles.btnSecondary} onClick={applyToAll} disabled={doneItems.length === 0}>
          Apply to All
        </button>
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginBottom: "1rem" }}>
        <table className={styles.table} style={{ fontSize: "0.82rem" }}>
          <thead>
            <tr><th>Person</th><th>Status</th><th style={{ width: 100 }}>Grade</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const person = peopleByNetId?.[item.net_id];
              return (
                <tr key={item.id}>
                  <td>
                    {person?.name || <span style={{ opacity: 0.4 }}>-</span>}
                    <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.76rem", fontFamily: "monospace", marginLeft: "0.4rem" }}>
                      {item.net_id}
                    </span>
                  </td>
                  <td><StatusBadge item={item} /></td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={maxScore ?? undefined}
                      value={grades[item.id]}
                      disabled={!item.is_done}
                      onChange={(e) => setGrades((g) => ({ ...g, [item.id]: e.target.value }))}
                      style={{ width: "100%", opacity: item.is_done ? 1 : 0.4 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.formGroup}>
        <label>Feedback for everyone graded in this save (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Applies to every grade saved below…" />
      </div>

      <div className={styles.modalActions}>
        <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancel</button>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save Grades"}
        </button>
      </div>
    </Modal>
  );
}
