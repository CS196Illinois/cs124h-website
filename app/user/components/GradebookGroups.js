"use client";

import { useState, Fragment } from "react";
import styles from "../dashboard.module.css";
import StudentGradesModal from "./StudentGradesModal";
import { averagePct, groupAveragePct, pivotColumns, buildAssignments } from "../../../lib/grading";
import { downloadCsv } from "../../../lib/csvExport";

function fmtPct(pct) {
  return pct != null ? `${pct.toFixed(1)}%` : "—";
}

function StudentTable({ students, items, onView }) {
  const sorted = [...students].sort((a, b) => (a.name || a.net_id).localeCompare(b.name || b.net_id));
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} style={{ fontSize: "0.85rem" }}>
        <thead>
          <tr><th>Name</th><th>NetID</th><th>Average</th><th>Graded</th><th></th></tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const mine = items.filter((i) => i.net_id === s.net_id);
            const graded = mine.filter((i) => i.grade != null);
            const avg = averagePct(mine);
            return (
              <tr key={s.net_id}>
                <td>{s.name || <span style={{ opacity: 0.4 }}>—</span>}</td>
                <td className={styles.cellMono}>{s.net_id}</td>
                <td style={{ fontWeight: 600 }}>{fmtPct(avg)}</td>
                <td style={{ color: "rgba(249,249,249,0.55)" }}>{graded.length}/{mine.length}</td>
                <td>
                  <button className={styles.btnSmall} style={{ background: "rgba(255,255,255,0.07)", color: "#f9f9f9", border: "1px solid rgba(255,255,255,0.15)" }} onClick={() => onView(s)}>
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "By Group" tab of the gradebook: group averages that expand into each
 * student's own average, with a "View" button to drill into that student's
 * full grade history (StudentGradesModal). With groupBy=false (a PM scoped
 * to their own group) there's only ever one group, so it's shown flat -
 * without a redundant single collapsible row - but export still works the
 * same way.
 */
export default function GradebookGroups({ students, items, groupBy }) {
  const [expanded, setExpanded] = useState(new Set());
  const [viewingStudent, setViewingStudent] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const exportCsv = (scopeStudents, scopeItems, filename, includeGroupColumn) => {
    const assignments = buildAssignments(scopeItems);
    downloadCsv(filename, pivotColumns(assignments, { includeGroupColumn }), scopeStudents);
  };

  if (!groupBy) {
    return (
      <div className={styles.panel}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
          <button className={styles.btnSecondary} onClick={() => exportCsv(students, items, `gradebook-group-${today}.csv`, false)}>
            Export Group CSV
          </button>
        </div>
        <StudentTable students={students} items={items} onView={setViewingStudent} />
        {viewingStudent && (
          <StudentGradesModal student={viewingStudent} items={items} onClose={() => setViewingStudent(null)} />
        )}
      </div>
    );
  }

  const groups = [...new Set(students.map((s) => s.group_number))].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });

  const toggle = (g) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: "0.5rem", flexWrap: "wrap" }}>
        <button className={styles.btnSecondary} onClick={() => setExpanded(expanded.size === groups.length ? new Set() : new Set(groups))}>
          {expanded.size === groups.length ? "Collapse All" : "Expand All"}
        </button>
        <button className={styles.btnPrimary} onClick={() => exportCsv(students, items, `gradebook-all-groups-${today}.csv`, true)}>
          Export Full Course CSV
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th></th><th>Group</th><th>Students</th><th>Average</th><th></th></tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const groupStudents = students.filter((s) => s.group_number === g);
              const groupItems = items.filter((i) => groupStudents.some((s) => s.net_id === i.net_id));
              const avg = groupAveragePct(groupStudents, groupItems);
              const isOpen = expanded.has(g);
              return (
                <Fragment key={g ?? "ungrouped"}>
                  <tr style={{ cursor: "pointer" }} onClick={() => toggle(g)}>
                    <td style={{ width: "1.5rem", opacity: 0.5 }}>{isOpen ? "▼" : "▶"}</td>
                    <td style={{ fontWeight: 600 }}>{g != null ? `Group ${g}` : "Ungrouped"}</td>
                    <td style={{ color: "rgba(249,249,249,0.55)" }}>{groupStudents.length}</td>
                    <td style={{ fontWeight: 600 }}>{fmtPct(avg)}</td>
                    <td>
                      <button
                        className={styles.btnSmall}
                        style={{ background: "rgba(255,255,255,0.07)", color: "#f9f9f9", border: "1px solid rgba(255,255,255,0.15)" }}
                        onClick={(e) => { e.stopPropagation(); exportCsv(groupStudents, groupItems, `gradebook-group-${g ?? "ungrouped"}-${today}.csv`, false); }}
                      >
                        Export Group CSV
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ padding: "0 0 1rem 0", background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ padding: "0.75rem 1rem 0" }}>
                          <StudentTable students={groupStudents} items={groupItems} onView={setViewingStudent} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewingStudent && (
        <StudentGradesModal student={viewingStudent} items={items} onClose={() => setViewingStudent(null)} />
      )}
    </div>
  );
}
