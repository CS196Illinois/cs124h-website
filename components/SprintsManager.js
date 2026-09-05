"use client";

import { useState, useEffect, useCallback } from "react";
import { useUndo } from "./UndoProvider";
import styles from "../app/user/dashboard.module.css";
import { DEFAULT_CHECK_QUESTIONS } from "../lib/sprintChecks";

function getCurrentSprint(sprints) {
  if (!sprints.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = sprints.find(
    (s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date
  );
  return active || sprints[0];
}

export default function SprintsManager({ canManage = false, renderExtra }) {
  const { scheduleUndo } = useUndo();
  const [sprints, setSprints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [completions, setCompletions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingComp, setLoadingComp] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [form, setForm] = useState({ number: "", goal: "", start_date: "", end_date: "", check_questions: [], check_max_score: "" });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    const [spRes, stuRes] = await Promise.all([
      fetch("/api/sprints"),
      fetch("/api/users?role=STUDENT"),
    ]);
    let fetchedSprints = [];
    if (spRes.ok) {
      fetchedSprints = await spRes.json();
      setSprints(fetchedSprints);
      if (fetchedSprints.length) {
        setSelectedId((prev) => prev ?? getCurrentSprint(fetchedSprints)?.id);
      }
    }
    if (stuRes.ok) setStudents(await stuRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingComp(true);
    fetch(`/api/sprints/${selectedId}/completions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setCompletions(data);
        setLoadingComp(false);
      });
  }, [selectedId]);

  const completedIds = new Set(completions.map((c) => c.student_net_id));

  const sortedGroups = Object.entries(
    students.reduce((acc, s) => {
      const g = s.group_number ?? "Unassigned";
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
      return acc;
    }, {})
  ).sort(([a], [b]) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return Number(a) - Number(b);
  });

  const openCreate = () => {
    const nextNum = sprints.length ? Math.max(...sprints.map((s) => s.number)) + 1 : 0;
    setForm({ number: String(nextNum), goal: "", start_date: "", end_date: "", check_questions: [], check_max_score: "" });
    setEditingSprint(null);
    setModalError(null);
    setShowModal(true);
  };

  const openEdit = (sprint) => {
    setForm({
      number: String(sprint.number),
      goal: sprint.goal,
      start_date: sprint.start_date ?? "",
      end_date: sprint.end_date ?? "",
      check_questions: sprint.check_questions ?? [],
      check_max_score: sprint.check_max_score ? String(sprint.check_max_score) : "",
    });
    setEditingSprint(sprint);
    setModalError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.goal.trim()) { setModalError("Goal is required"); return; }
    setSaving(true);
    setModalError(null);
    const body = {
      number: Number(form.number),
      goal: form.goal.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      check_questions: form.check_questions,
      check_max_score: form.check_max_score || null,
    };
    const res = editingSprint
      ? await fetch(`/api/sprints/${editingSprint.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/sprints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!res.ok) {
      const d = await res.json();
      setModalError(d.error || "Failed to save");
      setSaving(false);
      return;
    }
    const saved = await res.json();
    setSprints((prev) =>
      editingSprint
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [saved, ...prev]
    );
    if (!editingSprint) setSelectedId(saved.id);
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = (id) => {
    const sprint = sprints.find((s) => s.id === id);
    if (!sprint) return;
    const wasSelected = selectedId === id;
    setSprints((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (wasSelected) {
        setSelectedId(remaining.length ? (getCurrentSprint(remaining)?.id ?? remaining[0].id) : null);
      }
      return remaining;
    });
    scheduleUndo({
      message: `Deleted Sprint ${sprint.number}`,
      onExpire: () => fetch(`/api/sprints/${id}`, { method: "DELETE" }),
      onCancel: () => {
        setSprints((prev) => [...prev, sprint]);
        if (wasSelected) setSelectedId(id);
      },
    });
  };

  const selectedSprint = sprints.find((s) => s.id === selectedId);

  return (
    <div>
      {/* Sprint selector chips */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonBlock} style={{ height: "2rem", width: "80px", borderRadius: "20px" }} />
          ))
        ) : sprints.length === 0 ? (
          <span style={{ color: "rgba(249,249,249,0.4)", fontFamily: "Inter", fontSize: "0.85rem" }}>
            No sprints yet
          </span>
        ) : (
          [...sprints].reverse().map((s) => (
            <button
              key={s.id}
              className={`${styles.chip} ${selectedId === s.id ? styles.activeChip : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              Sprint {s.number}
            </button>
          ))
        )}
        {canManage && (
          <button className={styles.btnPrimary} style={{ marginLeft: "auto" }} onClick={openCreate}>
            + New Sprint
          </button>
        )}
      </div>

      {/* Selected sprint details */}
      {!loading && selectedSprint && (
        <div className={styles.panel} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ color: "rgba(249,249,249,0.45)", fontFamily: "Inter", fontSize: "0.8rem", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Sprint {selectedSprint.number}
              </div>
              <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontSize: "1.05rem", fontWeight: 600 }}>
                {selectedSprint.goal}
              </div>
              {(selectedSprint.start_date || selectedSprint.end_date) && (
                <div style={{ color: "rgba(249,249,249,0.4)", fontFamily: "Inter", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                  {selectedSprint.start_date &&
                    new Date(selectedSprint.start_date + "T00:00:00").toLocaleDateString()}
                  {selectedSprint.start_date && selectedSprint.end_date && " - "}
                  {selectedSprint.end_date &&
                    new Date(selectedSprint.end_date + "T00:00:00").toLocaleDateString()}
                </div>
              )}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button className={styles.btnSecondary} onClick={() => openEdit(selectedSprint)}>
                  Edit
                </button>
                <button className={styles.btnDanger} onClick={() => handleDelete(selectedSprint.id)}>
                  Delete
                </button>
              </div>
            )}
          </div>
          <div style={{ marginTop: "0.85rem", display: "inline-flex", gap: "0.4rem", alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.4rem 0.75rem" }}>
            <span style={{ color: "#4ade80", fontFamily: "Inter", fontWeight: 700, fontSize: "1rem" }}>
              {completedIds.size}
            </span>
            <span style={{ color: "rgba(249,249,249,0.5)", fontFamily: "Inter", fontSize: "0.85rem" }}>
              / {students.length} students complete
            </span>
          </div>
        </div>
      )}

      {!loading && selectedSprint && renderExtra && (
        <div style={{ marginBottom: "1rem" }}>{renderExtra(selectedSprint)}</div>
      )}

      {/* Completion table */}
      {!loading && selectedSprint && (
        <div className={styles.panel}>
          <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600, marginBottom: "1rem" }}>
            Sprint Completions
          </div>
          {loadingComp ? (
            <div className={styles.loading}>Loading completions…</div>
          ) : students.length === 0 ? (
            <div className={styles.emptyState}>No students found</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Name</th>
                    <th>NetID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGroups.map(([group, groupStudents]) =>
                    groupStudents.map((student, idx) => {
                      const done = completedIds.has(student.net_id);
                      return (
                        <tr key={student.net_id}>
                          {idx === 0 && (
                            <td
                              rowSpan={groupStudents.length}
                              style={{
                                verticalAlign: "top",
                                color: "rgba(249,249,249,0.5)",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                paddingTop: "0.85rem",
                              }}
                            >
                              {group === "Unassigned" ? "-" : `Group ${group}`}
                            </td>
                          )}
                          <td>{student.name || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td className={styles.cellMono}>{student.net_id}</td>
                          <td>
                            <span className={done ? styles.statusDone : styles.statusPending}>
                              <span
                                className={`${styles.statusDot} ${done ? styles.statusDoneDot : styles.statusPendingDot}`}
                              />
                              {done ? "Done" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{editingSprint ? "Edit Sprint" : "New Sprint"}</h2>
            {modalError && <div className={styles.alertError}>{modalError}</div>}
            <div className={styles.formGroup}>
              <label>Sprint Number</label>
              <input
                type="number"
                min="0"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Goal</label>
              <textarea
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="What should students accomplish this sprint?"
                rows={3}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Start Date (optional)</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>End Date (optional)</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
            {canManage && (
              <div className={styles.formGroup}>
                <label>Understanding Check Questions (optional)</label>
                {form.check_questions.length === 0 ? (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setForm((f) => ({ ...f, check_questions: [...DEFAULT_CHECK_QUESTIONS] }))}
                  >
                    + Add Understanding Check
                  </button>
                ) : (
                  <>
                    {form.check_questions.map((q, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
                        <textarea
                          rows={2}
                          value={q}
                          onChange={(e) => {
                            const value = e.target.value;
                            setForm((f) => ({
                              ...f,
                              check_questions: f.check_questions.map((x, xi) => (xi === i ? value : x)),
                            }));
                          }}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => setForm((f) => ({ ...f, check_questions: f.check_questions.filter((_, xi) => xi !== i) }))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setForm((f) => ({ ...f, check_questions: [...f.check_questions, ""] }))}
                    >
                      + Add Question
                    </button>
                    <div style={{ marginTop: "0.75rem" }}>
                      <label>Max Score (optional, defaults to 100)</label>
                      <input
                        type="number"
                        min="1"
                        value={form.check_max_score}
                        onChange={(e) => setForm((f) => ({ ...f, check_max_score: e.target.value }))}
                        placeholder="100"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingSprint ? "Save Changes" : "Create Sprint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
