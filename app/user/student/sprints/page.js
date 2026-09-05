"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";

function getCurrentSprint(sprints) {
  if (!sprints.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = sprints.find((s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date);
  return active || sprints[0];
}

export default function StudentSprints() {
  const { status } = useSession();
  const [sprints, setSprints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchSprints = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sprints");
    if (res.ok) {
      const data = await res.json();
      setSprints(data);
      setSelectedId((prev) => prev ?? getCurrentSprint(data)?.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") fetchSprints(); }, [status, fetchSprints]);

  const fetchCheck = useCallback(async () => {
    if (!selectedId) return;
    setLoadingCheck(true);
    setError("");
    const res = await fetch(`/api/sprints/${selectedId}/check`);
    const data = res.ok ? await res.json() : null;
    setCheck(data);
    setAnswers(data?.questions ? data.questions.map(() => "") : []);
    setLoadingCheck(false);
  }, [selectedId]);

  useEffect(() => { fetchCheck(); }, [fetchCheck]);

  const selectedSprint = sprints.find((s) => s.id === selectedId);

  const handleSubmit = async () => {
    setError("");
    if (answers.some((a) => !a.trim())) { setError("Answer every question before submitting."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/sprints/${selectedId}/check/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to submit."); setSubmitting(false); return; }
    await fetchCheck();
    setSubmitting(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Sprints</h1>
        <p>Weekly sprint goals and understanding checks</p>
      </div>

      {!loading && sprints.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {[...sprints].reverse().map((s) => (
            <button
              key={s.id}
              className={`${styles.chip} ${selectedId === s.id ? styles.activeChip : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              Sprint {s.number}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : !selectedSprint ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}><span className={styles.emptyIcon}>📋</span>No sprints yet</div>
        </div>
      ) : (
        <>
          <div className={styles.panel} style={{ marginBottom: "1rem" }}>
            <div style={{ color: "rgba(249,249,249,0.45)", fontFamily: "Inter", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
              Sprint {selectedSprint.number}
            </div>
            <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600, fontSize: "1.05rem" }}>{selectedSprint.goal}</div>
          </div>

          <div className={styles.panel}>
            <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600, marginBottom: "0.75rem" }}>Understanding Check</div>
            {loadingCheck || !check ? (
              <div className={styles.loading}>Loading…</div>
            ) : !check.hasCheck ? (
              <div className={styles.emptyState} style={{ padding: "1rem 0" }}>No understanding check for this sprint</div>
            ) : check.mySubmission ? (
              <div>
                {check.questions.map((q, i) => (
                  <div key={i} style={{ marginBottom: "1rem" }}>
                    <div style={{ color: "rgba(249,249,249,0.55)", fontFamily: "Inter", fontSize: "0.85rem", marginBottom: "0.3rem" }}>{q}</div>
                    <div style={{ color: "#f9f9f9", fontFamily: "Inter", fontSize: "0.9rem", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.7rem", whiteSpace: "pre-wrap" }}>
                      {check.mySubmission.answers[i]}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  {check.mySubmission.grade != null ? (
                    <>
                      <span style={{ color: "#4f8dde", fontWeight: 600 }}>Grade: {check.mySubmission.grade}/{check.maxScore}</span>
                      {check.mySubmission.gradeNote && (
                        <div style={{ color: "rgba(249,249,249,0.6)", fontStyle: "italic", marginTop: "0.4rem" }}>“{check.mySubmission.gradeNote}”</div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#ecb557" }}>Submitted - awaiting grade</span>
                  )}
                </div>
              </div>
            ) : !check.isOpen ? (
              <div className={styles.emptyState} style={{ padding: "1rem 0" }}>
                <span className={styles.emptyIcon}>🔒</span>
                Not available right now - your PM opens this during your weekly meeting.
              </div>
            ) : (
              <div>
                {error && <div className={styles.alertError}>{error}</div>}
                {check.questions.map((q, i) => (
                  <div className={styles.formGroup} key={i}>
                    <label>{q}</label>
                    <textarea
                      rows={3}
                      value={answers[i] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAnswers((prev) => prev.map((a, ai) => (ai === i ? value : a)));
                      }}
                    />
                  </div>
                ))}
                <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
