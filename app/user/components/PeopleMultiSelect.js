"use client";

import { useMemo, useState } from "react";
import styles from "../dashboard.module.css";

/**
 * Searchable multi-select checklist for choosing action-item recipients.
 * `people` should already be scoped to whoever the caller is allowed to target.
 */
export default function PeopleMultiSelect({ people, selected, onChange, roleLabelFn }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const netId = p.net_id.toLowerCase();
      const group = p.group_number != null ? String(p.group_number) : "";
      return name.includes(q) || netId.includes(q) || group.includes(q);
    });
  }, [people, search]);

  const selectedSet = new Set(selected);

  const toggle = (net_id) => {
    onChange(selectedSet.has(net_id) ? selected.filter((id) => id !== net_id) : [...selected, net_id]);
  };
  const selectAllFiltered = () => {
    onChange([...new Set([...selected, ...filtered.map((p) => p.net_id)])]);
  };
  const clearFiltered = () => {
    const filteredIds = new Set(filtered.map((p) => p.net_id));
    onChange(selected.filter((id) => !filteredIds.has(id)));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
        <input
          className={styles.searchBar}
          style={{ flex: 1 }}
          placeholder="Search name, NetID, or group…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
          {selected.length} selected
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
          onClick={selectAllFiltered}
          disabled={filtered.length === 0}
        >
          Select all{search ? " filtered" : ""} ({filtered.length})
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
          onClick={clearFiltered}
          disabled={!filtered.some((p) => selectedSet.has(p.net_id))}
        >
          Clear{search ? " filtered" : " all"}
        </button>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "rgba(249,249,249,0.35)", fontSize: "0.82rem", fontFamily: "Inter, sans-serif" }}>
            No matches
          </div>
        ) : (
          filtered.map((p) => {
            const checked = selectedSet.has(p.net_id);
            return (
              <label
                key={p.net_id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.45rem 0.7rem", cursor: "pointer",
                  background: checked ? "rgba(236,181,87,0.08)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <input type="checkbox" className={styles.checkboxInput} checked={checked} onChange={() => toggle(p.net_id)} />
                <span style={{ color: "#f9f9f9", fontSize: "0.85rem", fontFamily: "Inter, sans-serif" }}>
                  {p.name || <span style={{ opacity: 0.4 }}>-</span>}
                </span>
                <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", fontFamily: "monospace" }}>{p.net_id}</span>
                {roleLabelFn && p.role && (
                  <span style={{ color: "rgba(249,249,249,0.4)", fontSize: "0.72rem", fontFamily: "Inter, sans-serif" }}>{roleLabelFn(p.role)}</span>
                )}
                {p.group_number != null && (
                  <span style={{ marginLeft: "auto", color: "rgba(249,249,249,0.35)", fontSize: "0.75rem" }}>Group {p.group_number}</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
