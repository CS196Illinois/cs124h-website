"use client";

import { useState, useMemo, Fragment } from "react";
import styles from "../dashboard.module.css";
import StudentGradesModal from "./StudentGradesModal";
import StatusBadge from "./StatusBadge";
import { buildAssignments, assignmentLabel, averagePct, itemPct, pivotColumns } from "../../../lib/grading";
import { downloadCsv } from "../../../lib/csvExport";

function fmtPct(pct) {
  return pct != null ? `${pct.toFixed(1)}%` : "—";
}

function slugify(title) {
  return title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "assignment";
}

function AssignmentStudentTable({ students, assignment, onView }) {
  const sorted = [...students].sort((a, b) => (a.name || a.net_id).localeCompare(b.name || b.net_id));
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} style={{ fontSize: "0.85rem" }}>
        <thead>
          <tr><th>Name</th><th>NetID</th><th>Status</th><th>%</th><th></th></tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const item = assignment.items.find((i) => i.net_id === s.net_id);
            const pct = item ? itemPct(item) : null;
            return (
              <tr key={s.net_id}>
                <td>{s.name || <span style={{ opacity: 0.4 }}>—</span>}</td>
                <td className={styles.cellMono}>{s.net_id}</td>
                <td>{item ? <StatusBadge item={item} /> : <span style={{ color: "rgba(249,249,249,0.3)" }}>Not assigned</span>}</td>
                <td style={{ fontWeight: 600 }}>{fmtPct(pct)}</td>
                <td>
                  <button
                    className={styles.btnSmall}
                    style={{ background: "rgba(255,255,255,0.07)", color: "#f9f9f9", border: "1px solid rgba(255,255,255,0.15)" }}
                    onClick={() => onView(s)}
                  >
                    View All Grades
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

function GroupBreakdown({ students, assignment, expanded, onToggle, onView, onExportGroup }) {
  const groups = [...new Set(students.map((s) => s.group_number))].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr><th></th><th>Group</th><th>Students</th><th>Average</th><th></th></tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const groupStudents = students.filter((s) => s.group_number === g);
            const groupItems = assignment.items.filter((i) => groupStudents.some((s) => s.net_id === i.net_id));
            const avg = averagePct(groupItems);
            const isOpen = expanded.has(g);
            return (
              <Fragment key={g ?? "ungrouped"}>
                <tr style={{ cursor: "pointer" }} onClick={() => onToggle(g)}>
                  <td style={{ width: "1.5rem", opacity: 0.5 }}>{isOpen ? "▼" : "▶"}</td>
                  <td style={{ fontWeight: 600 }}>{g != null ? `Group ${g}` : "Ungrouped"}</td>
                  <td style={{ color: "rgba(249,249,249,0.55)" }}>{groupStudents.length}</td>
                  <td style={{ fontWeight: 600 }}>{fmtPct(avg)}</td>
                  <td>
                    <button
                      className={styles.btnSmall}
                      style={{ background: "rgba(255,255,255,0.07)", color: "#f9f9f9", border: "1px solid rgba(255,255,255,0.15)" }}
                      onClick={(e) => { e.stopPropagation(); onExportGroup(groupStudents, g); }}
                    >
                      Export Group CSV
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={5} style={{ padding: "0 0 1rem 0", background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ padding: "0.75rem 1rem 0" }}>
                        <AssignmentStudentTable students={groupStudents} assignment={assignment} onView={onView} />
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
  );
}

/**
 * "By Assignment" tab of the gradebook: pick one assignment (by title +
 * date, since recurring titles like "Weekly Check-in" repeat across many
 * assignments) and see just that assignment's grades - group averages that
 * expand into individual grades for course leads/head PMs, or a flat
 * student list for a PM already scoped to one group.
 */
export default function GradebookAssignments({ students, items, groupBy }) {
  const assignments = useMemo(() => buildAssignments(items), [items]);
  const [selectedKey, setSelectedKey] = useState(assignments[0]?.key ?? null);
  const [expanded, setExpanded] = useState(new Set());
  const [viewingStudent, setViewingStudent] = useState(null);

  if (assignments.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📊</span>No gradable assignments yet.
      </div>
    );
  }

  const assignment = assignments.find((a) => a.key === selectedKey) ?? assignments[0];
  const assignedCount = assignment.items.length;
  const gradedCount = assignment.items.filter((i) => i.grade != null).length;
  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `${slugify(assignment.title)}-${today}`;

  const toggle = (g) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const exportCsv = (scopeStudents, filename) => {
    downloadCsv(filename, pivotColumns([assignment], { includeGroupColumn: groupBy }), scopeStudents);
  };

  return (
    <div>
      <div className={styles.panel} style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div className={styles.formGroup} style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Assignment</label>
            <select value={assignment.key} onChange={(e) => setSelectedKey(e.target.value)}>
              {assignments.map((a) => <option key={a.key} value={a.key}>{assignmentLabel(a)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", color: "rgba(249,249,249,0.55)", fontSize: "0.85rem", fontFamily: "Inter, sans-serif" }}>
            <span>{assignment.max_score != null ? `Out of ${assignment.max_score}` : "No max score"}</span>
            <span>{gradedCount}/{assignedCount} graded</span>
          </div>
          <button
            className={styles.btnPrimary}
            onClick={() => exportCsv(students, `${fileBase}-${groupBy ? "all-groups" : "group"}.csv`)}
          >
            Export {groupBy ? "Full Course" : "Group"} CSV
          </button>
        </div>
      </div>

      {!groupBy ? (
        <div className={styles.panel}>
          <AssignmentStudentTable students={students} assignment={assignment} onView={setViewingStudent} />
        </div>
      ) : (
        <GroupBreakdown
          students={students}
          assignment={assignment}
          expanded={expanded}
          onToggle={toggle}
          onView={setViewingStudent}
          onExportGroup={(groupStudents, g) => exportCsv(groupStudents, `${fileBase}-group-${g ?? "ungrouped"}.csv`)}
        />
      )}

      {viewingStudent && (
        <StudentGradesModal student={viewingStudent} items={items} onClose={() => setViewingStudent(null)} />
      )}
    </div>
  );
}
