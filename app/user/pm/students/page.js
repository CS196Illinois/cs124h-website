"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";
import { downloadCsv } from "../../../../lib/csvExport";

function getCurrentSprint(sprints) {
  if (!sprints.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = sprints.find(
    (s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date
  );
  return active || sprints[0];
}

export default function PMStudents() {
  const { data: session, status } = useSession();
  const [myRecord, setMyRecord] = useState(null);
  const [students, setStudents] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [completions, setCompletions] = useState([]);
  const [loadingComp, setLoadingComp] = useState(false);
  const [toggling, setToggling] = useState(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, itemsRes, spRes] = await Promise.all([
      fetch("/api/users/me"),
      fetch("/api/action_items"),
      fetch("/api/sprints"),
    ]);
    let me = null;
    if (meRes.ok) { me = await meRes.json(); setMyRecord(me); }
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    if (spRes.ok) {
      const spData = await spRes.json();
      setSprints(spData);
      const cur = getCurrentSprint(spData);
      setSelectedSprint(cur ?? null);
    }
    if (me?.group_number) {
      const stuRes = await fetch(`/api/users?role=STUDENT&group=${me.group_number}`);
      if (stuRes.ok) setStudents(await stuRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  useEffect(() => {
    if (!selectedSprint) { setCompletions([]); return; }
    setLoadingComp(true);
    fetch(`/api/sprints/${selectedSprint.id}/completions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setCompletions(data); setLoadingComp(false); });
  }, [selectedSprint]);

  const completedIds = new Set(completions.map((c) => c.student_net_id));

  const toggleCompletion = async (student) => {
    if (!selectedSprint) return;
    const netId = student.net_id;
    const wasDone = completedIds.has(netId);
    setToggling((prev) => new Set(prev).add(netId));

    if (wasDone) {
      setCompletions((prev) => prev.filter((c) => c.student_net_id !== netId));
      await fetch(`/api/sprints/${selectedSprint.id}/completions?student_net_id=${encodeURIComponent(netId)}`, {
        method: "DELETE",
      });
    } else {
      setCompletions((prev) => [
        ...prev,
        { sprint_id: selectedSprint.id, student_net_id: netId, marked_by: session?.user?.netID, completed_at: new Date().toISOString() },
      ]);
      await fetch(`/api/sprints/${selectedSprint.id}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_net_id: netId }),
      });
    }

    setToggling((prev) => { const s = new Set(prev); s.delete(netId); return s; });
  };

  const groupNumber = myRecord?.group_number;
  const filteredStudents = students.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.net_id.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
  });

  const handleExport = () => {
    downloadCsv(
      `my-students-group-${groupNumber}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "name", label: "Name" },
        { key: "net_id", label: "NetID" },
        {
          key: "open_items",
          label: "Open Items",
          value: (u) => actionItems.filter((a) => a.net_id === u.net_id && !a.is_done).length,
        },
        ...(selectedSprint
          ? [{
              key: "sprint_status",
              label: `Sprint ${selectedSprint.number}`,
              value: (u) => (completedIds.has(u.net_id) ? "Done" : "Pending"),
            }]
          : []),
      ],
      filteredStudents,
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Students</h1>
        <p>
          {groupNumber
            ? `Group ${groupNumber} · ${students.length} student${students.length !== 1 ? "s" : ""}`
            : "No group assigned"}
        </p>
      </div>

      {/* Sprint selector */}
      {!loading && sprints.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{ color: "rgba(249,249,249,0.45)", fontFamily: "Inter", fontSize: "0.8rem", marginRight: "0.25rem" }}>
            Sprint:
          </span>
          {[...sprints].reverse().map((s) => (
            <button
              key={s.id}
              className={`${styles.chip} ${selectedSprint?.id === s.id ? styles.activeChip : ""}`}
              onClick={() => setSelectedSprint(s)}
            >
              Sprint {s.number}
            </button>
          ))}
        </div>
      )}

      {!groupNumber ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            You have no group assigned yet. Contact a Course Lead.
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>
              Group {groupNumber} · {students.length} student{students.length !== 1 ? "s" : ""}
              {selectedSprint && !loadingComp && (
                <span style={{ color: "rgba(249,249,249,0.45)", fontWeight: 400, marginLeft: "0.75rem", fontSize: "0.85rem" }}>
                  {completedIds.size}/{students.length} complete this sprint
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                className={styles.searchBar}
                placeholder="Search name or NetID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className={styles.btnSecondary} onClick={handleExport} disabled={filteredStudents.length === 0}>
                Export CSV
              </button>
            </div>
          </div>
          {loading ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>NetID</th>
                    <th>Open Items</th>
                    <th>Sprint</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "65%" }} /></td>
                      <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "55%" }} /></td>
                      <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "25%" }} /></td>
                      <td><div className={styles.skeletonBlock} style={{ height: "1.6rem", width: "70px", borderRadius: "5px" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>👤</span>No students found
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>NetID</th>
                    <th>Open Items</th>
                    {selectedSprint && <th>Sprint {selectedSprint.number}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((u) => {
                    const studentOpenItems = actionItems.filter((a) => a.net_id === u.net_id && !a.is_done).length;
                    const done = completedIds.has(u.net_id);
                    const busy = toggling.has(u.net_id);
                    return (
                      <tr key={u.net_id}>
                        <td>{u.name || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td className={styles.cellMono}>{u.net_id}</td>
                        <td>
                          <span style={{ color: studentOpenItems > 0 ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>
                            {studentOpenItems}
                          </span>
                        </td>
                        {selectedSprint && (
                          <td>
                            <button
                              className={`${styles.btnSmall} ${done ? styles.btnReopen : styles.btnComplete}`}
                              onClick={() => toggleCompletion(u)}
                              disabled={busy || loadingComp}
                            >
                              {busy ? "…" : done ? "Done ✓" : "Pending"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
