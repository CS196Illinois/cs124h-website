"use client";

import styles from "../dashboard.module.css";

/**
 * Flat "needs my grading" list for the assigner. Items sharing a batch_id
 * (bulk-assigned together) collapse into a single row with one Grade Batch
 * action, instead of one row per recipient.
 */
export default function NeedsGradingList({ items, allItems, peopleByNetId, onGradeSingle, onGradeBatch }) {
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>✅</span>Nothing waiting on your grade
      </div>
    );
  }

  const batches = new Map();
  const standalone = [];
  for (const item of items) {
    if (item.batch_id) {
      if (!batches.has(item.batch_id)) batches.set(item.batch_id, []);
      batches.get(item.batch_id).push(item);
    } else {
      standalone.push(item);
    }
  }

  const rows = [
    ...[...batches.entries()].map(([batchId, pending]) => ({
      key: batchId,
      type: "batch",
      batchId,
      pending,
      fullBatch: allItems.filter((i) => i.batch_id === batchId),
      title: pending[0].title,
      due_date: pending[0].due_date,
    })),
    ...standalone.map((item) => ({ key: item.id, type: "single", item, title: item.title, due_date: item.due_date })),
  ];

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead><tr><th>Title</th><th>People</th><th>Due</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.title}</td>
              <td>
                {row.type === "batch" ? (
                  <span>
                    {row.pending.length} pending
                    <span style={{ color: "rgba(249,249,249,0.4)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>
                      ({row.fullBatch.length} total in batch)
                    </span>
                  </span>
                ) : (
                  <span>
                    {peopleByNetId?.[row.item.net_id]?.name || <span style={{ opacity: 0.4 }}>—</span>}
                    <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", fontFamily: "monospace", marginLeft: "0.4rem" }}>
                      {row.item.net_id}
                    </span>
                  </span>
                )}
              </td>
              <td style={{ color: "rgba(249,249,249,0.6)", fontSize: "0.85rem" }}>
                {row.due_date ? new Date(row.due_date).toLocaleDateString() : "-"}
              </td>
              <td>
                <button
                  className={styles.btnSmall}
                  style={{ background: "rgba(236,181,87,0.15)", color: "#ecb557", border: "1px solid rgba(236,181,87,0.25)" }}
                  onClick={() => (row.type === "batch" ? onGradeBatch(row.batchId, row.fullBatch) : onGradeSingle(row.item))}
                >
                  {row.type === "batch" ? `Grade Batch (${row.pending.length})` : "Grade"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
