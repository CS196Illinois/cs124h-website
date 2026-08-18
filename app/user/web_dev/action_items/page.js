"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";
import ActionCardList from "../../components/ActionCardList";
import EmptyState from "../../components/EmptyState";

export default function WebDevActionItems() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("todo");
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/action_items");
    if (res.ok) setActionItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchItems();
  }, [status, fetchItems]);

  const handleToggle = async (id, is_done) => {
    await fetch(`/api/action_items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !is_done }),
    });
    await fetchItems();
  };

  const todo = actionItems.filter((a) => !a.is_done);
  const done = actionItems.filter((a) => a.is_done);
  const display = activeTab === "todo" ? todo : done;

  if (status === "loading") return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Action Items</h1>
        <p>{session?.user?.name || session?.user?.netID}</p>
      </div>

      <div className={styles.statsGrid}>
        {[{ label: "To Do", val: todo.length }, { label: "Completed", val: done.length }, { label: "Total", val: actionItems.length }].map(({ label, val }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statNumber}>{val}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === "todo" ? styles.activeTab : ""}`} onClick={() => setActiveTab("todo")}>
          To Do
          {todo.length > 0 && (
            <span style={{ background: "#ecb557", color: "#112a67", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.75rem", marginLeft: "0.4rem", fontWeight: 700 }}>
              {todo.length}
            </span>
          )}
        </button>
        <button className={`${styles.tab} ${activeTab === "done" ? styles.activeTab : ""}`} onClick={() => setActiveTab("done")}>
          Completed
        </button>
      </div>

      <div className={styles.panel}>
        {loading ? (
          <div className={styles.loading}>Loading…</div>
        ) : display.length === 0 ? (
          <EmptyState
            icon={activeTab === "todo" ? "🎉" : "📭"}
            message={activeTab === "todo" ? "You're all caught up!" : "No completed items yet"}
          />
        ) : (
          <ActionCardList items={display} onToggle={handleToggle} />
        )}
      </div>
    </div>
  );
}
