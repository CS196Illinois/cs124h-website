"use client";

import { useState } from "react";
import { formatGrade, itemPct } from "../../../lib/grading";
import { formatDueDate, formatLocalDate } from "../../../lib/dateFormat";
import styles from "./CompletedItems.module.css";

export default function CompletedItems({ items, onToggle }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const visible = items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (
    filter === "all" || (filter === "graded" && item.is_gradable && item.grade != null) ||
    (filter === "waiting" && item.is_gradable && item.grade == null) || (filter === "ungraded" && !item.is_gradable)
  )).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : new Date(b.completion_date || b.created_at) - new Date(a.completion_date || a.created_at));

  return <section className={styles.section} aria-label="Completed action items and grades">
    <div className={styles.toolbar}>
      <label>Find an assignment<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title" /></label>
      <label>Show<select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All completed</option><option value="graded">Graded</option><option value="waiting">Awaiting grade</option><option value="ungraded">Not graded</option>
      </select></label>
      <label>Sort by<select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Recently completed</option><option value="title">Assignment name</option></select></label>
    </div>
    <p className={styles.muted} aria-live="polite">{visible.length} of {items.length} completed items</p>
    {visible.length === 0 && <p>No assignments match these filters.</p>}
    {visible.map((item) => {
      const pct = item.is_gradable ? itemPct(item) : null;
      const graded = item.is_gradable && item.grade != null;
      return <article key={item.id} className={styles.assignment}>
        <div className={styles.summary}>
          <div><h2>{item.title}</h2><p className={styles.muted}>
            {item.due_date ? `Due ${formatDueDate(item.due_date)}` : "No due date"}
            {item.completion_date && ` · Completed ${formatLocalDate(item.completion_date)}`}
          </p></div>
          <div className={styles.score}>
            <span className={graded ? styles.graded : styles.pending}>{graded ? "Graded" : item.is_gradable ? "Awaiting grade" : "Not graded"}</span>
            {graded && <><strong>{formatGrade(item)}</strong>{pct != null && <span>{pct.toFixed(1)}%</span>}</>}
          </div>
        </div>
        <details className={styles.details}>
          <summary>{item.grade_note ? "View feedback and details" : "View details"}</summary>
          {item.grade_note && <div className={styles.feedback}><h3>Feedback</h3><p>{item.grade_note}</p></div>}
          {item.description && <p>{item.description}</p>}
          <p className={styles.muted}>Assigned by {item.assigned_by || item.additional_info?.assigned_by || "Course staff"}</p>
          {item.graded_at && <p className={styles.muted}>Graded {formatLocalDate(item.graded_at)}</p>}
          {!item.sprint_id && <button type="button" onClick={() => {
            if (graded && !window.confirm("Reopening this item clears its grade and feedback. Continue?")) return;
            onToggle(item.id, true);
          }}>Reopen item</button>}
        </details>
      </article>;
    })}
  </section>;
}
