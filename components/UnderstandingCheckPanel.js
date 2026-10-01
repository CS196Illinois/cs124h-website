"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../app/user/dashboard.module.css";
import GradeActionItemModal from "../app/user/components/GradeActionItemModal";

function RosterTable({ roster, onGrade }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} style={{ fontSize: "0.85rem" }}>
        <thead><tr><th>Name</th><th>NetID</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.net_id}>
              <td>{r.name || <span style={{ opacity: 0.4 }}>—</span>}</td>
              <td className={styles.cellMono}>{r.net_id}</td>
              <td>
                {!r.submitted ? (
                  <span style={{ color: "rgba(249,249,249,0.4)" }}>Not submitted</span>
                ) : r.item.grade != null ? (
                  <span style={{ color: "#4f8dde" }}>Graded {r.item.grade}/{r.item.max_score}</span>
                ) : (
                  <span style={{ color: "#ecb557" }}>Ready to grade</span>
                )}
              </td>
              <td>
                {r.submitted && (
                  <button
                    className={styles.btnSmall}
                    style={{ background: "rgba(236,181,87,0.15)", color: "#ecb557", border: "1px solid rgba(236,181,87,0.25)" }}
                    onClick={() => onGrade(r.item)}
                  >
                    {r.item.grade != null ? "Edit Grade" : "Grade"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Understanding-check status/grading for a selected sprint. `scope="my-group"`
 * (PM) shows just their own group's roster; `scope="all-groups"` (course
 * lead/head PM) shows every group, each expandable. Rendered by
 * SprintsManager's `renderExtra`.
 */
export default function UnderstandingCheckPanel({ sprint, scope: requestedScope }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyGroup, setBusyGroup] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [error, setError] = useState(null);
  const [grading, setGrading] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/check`);
      if (!res.ok) throw new Error("The understanding check could not be loaded. Please try again.");
      setData(await res.json());
      setError(null);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sprint.id, sprint.check_questions]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleWindow = async (groupNumber, isOpen) => {
    setBusyGroup(groupNumber);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/check/${isOpen ? "close" : "open"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_number: groupNumber }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || "The check could not be updated. Please try again.");
      }
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyGroup(null);
    }
  };

  const toggleExpand = (g) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  if (loading) {
    return <div className={styles.panel}><div className={styles.loading}>Loading understanding check…</div></div>;
  }

  if (!data) {
    return <div className={styles.panel}>
      <p role="alert">{error}</p>
      <button className={styles.btnSecondary} onClick={fetchData}>Retry</button>
    </div>;
  }

  if (!data.hasCheck) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyState} style={{ padding: "1.5rem 0" }}>
          No understanding check configured for this sprint
        </div>
      </div>
    );
  }

  // A lead web dev testing the PM page gets the all-groups response; render it
  // as such instead of claiming they have no group.
  const scope = requestedScope === "my-group" && data.groups ? "all-groups" : requestedScope;

  // A web dev assigned to a group always gets the single-group (PM) response,
  // even on a manager page reached through a role-view. Fold it into the shape
  // the all-groups view iterates so that path can never hit an undefined list.
  const groups = data.groups
    ?? (data.groupNumber != null
      ? [{ groupNumber: data.groupNumber, isOpen: data.isOpen, roster: data.roster ?? [] }]
      : []);

  const countedRosters = scope === "my-group" ? [data.roster ?? []] : groups.map((g) => g.roster);
  const submittedTotal = countedRosters.reduce((acc, roster) => ({
    submitted: acc.submitted + roster.filter((r) => r.submitted).length,
    total: acc.total + roster.length,
  }), { submitted: 0, total: 0 });

  return (
    <div className={styles.panel}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Understanding Check</span>
        {submittedTotal.total > 0 && (
          <span style={{ color: "rgba(249,249,249,0.55)", fontFamily: "Inter", fontSize: "0.85rem" }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{submittedTotal.submitted}</span> / {submittedTotal.total} {scope === "my-group" ? "students in your group submitted" : "students submitted"}
          </span>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {scope === "my-group" && data.groupNumber != null && (
        <div className={styles.checkControls}>
          <div>
            <span style={{ color: data.isOpen ? "#4ade80" : "#f9f9f9", fontWeight: 600 }}>
              {data.isOpen ? "● Open" : "● Closed"}
            </span>
            <p>{data.isOpen ? "Your students can submit their answers now." : "Open the check when your group’s meeting begins so students can submit."}</p>
          </div>
          <button data-tour="sprint-open-check"
            className={`${data.isOpen ? styles.btnDanger : styles.btnPrimary} ${styles.checkToggle}`}
            onClick={() => toggleWindow(data.groupNumber, data.isOpen)}
            disabled={busyGroup === data.groupNumber}>
            {busyGroup === data.groupNumber ? "Updating…" : data.isOpen ? "Close Understanding Check" : "Open Understanding Check"}
          </button>
        </div>
      )}
      <ol style={{ color: "rgba(249,249,249,0.7)", fontFamily: "Inter", fontSize: "0.88rem", paddingLeft: "1.2rem", marginBottom: "1.1rem" }}>
        {(data.questions ?? []).map((q, i) => <li key={i} style={{ marginBottom: "0.3rem" }}>{q}</li>)}
      </ol>

      {scope === "my-group" ? (
        data.groupNumber == null ? (
          <div className={styles.emptyState} style={{ padding: "1rem 0" }}>You have no group assigned yet.</div>
        ) : (
          <RosterTable roster={data.roster} onGrade={setGrading} />
        )
      ) : groups.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: "1rem 0" }}>No groups with students yet.</div>
      ) : (
        groups.map((g) => {
          const isOpenRow = expanded.has(g.groupNumber);
          const submittedCount = g.roster.filter((r) => r.submitted).length;
          return (
            <div key={g.groupNumber} style={{ marginBottom: "0.75rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>
              <div onClick={() => toggleExpand(g.groupNumber)} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.9rem", cursor: "pointer" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{isOpenRow ? "▼" : "▶"}</span>
                <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Group {g.groupNumber}</span>
                <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.82rem" }}>{submittedCount}/{g.roster.length} submitted</span>
                <span style={{ marginLeft: "auto", color: g.isOpen ? "#4ade80" : "rgba(249,249,249,0.4)", fontSize: "0.82rem", fontWeight: 600 }}>
                  {g.isOpen ? "● Open" : "● Closed"}
                </span>
                <button
                  className={`${styles.btnSmall} ${g.isOpen ? styles.btnDanger : styles.btnComplete}`}
                  onClick={(e) => { e.stopPropagation(); toggleWindow(g.groupNumber, g.isOpen); }}
                  disabled={busyGroup === g.groupNumber}
                >
                  {busyGroup === g.groupNumber ? "…" : g.isOpen ? "Close" : "Open"}
                </button>
              </div>
              {isOpenRow && <div style={{ padding: "0 0.9rem 0.9rem" }}>
                {g.additionalQuestions?.length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ color: "rgba(249,249,249,0.55)", fontFamily: "Inter", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      Added by this group’s PM
                    </div>
                    <ol start={(data.questions ?? []).length + 1} style={{ color: "rgba(249,249,249,0.7)", fontFamily: "Inter", fontSize: "0.88rem", paddingLeft: "1.2rem", margin: 0 }}>
                      {g.additionalQuestions.map((q, i) => <li key={i} style={{ marginBottom: "0.3rem" }}>{q}</li>)}
                    </ol>
                  </div>
                )}
                <RosterTable roster={g.roster} onGrade={setGrading} />
              </div>}
            </div>
          );
        })
      )}

      {grading && (
        <GradeActionItemModal item={grading} onClose={() => setGrading(null)} onSaved={fetchData} />
      )}
    </div>
  );
}
