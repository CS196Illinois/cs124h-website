"use client";

import { useState } from "react";
import Modal from "./Modal";
import styles from "../dashboard.module.css";

export default function EditActionItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description || "",
    due_date: item.due_date ? item.due_date.split("T")[0] : "",
    is_gradable: !!item.is_gradable,
    max_score: item.max_score ?? 100,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!form.title.trim()) { setError("Title is required."); return; }
    setLoading(true);
    const res = await fetch(`/api/action_items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        is_gradable: form.is_gradable,
        max_score: form.is_gradable ? Number(form.max_score) || 100 : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to save."); setLoading(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2>Edit Action Item</h2>
      {error && <div className={styles.alertError}>{error}</div>}
      <div className={styles.formGroup}>
        <label>Title *</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className={styles.formGroup}>
        <label>Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details…" />
      </div>
      <div className={styles.formGroup}>
        <label>Due Date</label>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={form.is_gradable}
            onChange={(e) => setForm({ ...form, is_gradable: e.target.checked })}
          />
          Gradable
        </label>
      </div>
      {form.is_gradable && (
        <div className={styles.formGroup}>
          <label>Max Score</label>
          <input
            type="number"
            min="1"
            value={form.max_score}
            onChange={(e) => setForm({ ...form, max_score: e.target.value })}
            placeholder="100"
          />
        </div>
      )}
      <div className={styles.modalActions}>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}
