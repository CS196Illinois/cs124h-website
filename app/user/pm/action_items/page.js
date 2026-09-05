"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useUndo } from "../../../../components/UndoProvider";
import styles from "../../dashboard.module.css";
import Modal from "../../components/Modal";
import EditActionItemModal from "../../components/EditActionItemModal";
import GradeActionItemModal from "../../components/GradeActionItemModal";
import BatchGradeModal from "../../components/BatchGradeModal";
import NeedsGradingList from "../../components/NeedsGradingList";
import PeopleMultiSelect from "../../components/PeopleMultiSelect";
import PersonAccordion from "../../components/PersonAccordion";
import ActionItemRow from "../../components/ActionItemRow";
import StatusBadge from "../../components/StatusBadge";
import EmptyState from "../../components/EmptyState";

export default function PMActionItems() {
  const { data: session, status } = useSession();
  const myNetId = session?.user?.netID;
  const { scheduleUndo } = useUndo();

  const [actionItems, setActionItems] = useState([]);
  const [myRecord, setMyRecord] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState("mine");
  const [statusFilter, setStatusFilter] = useState("open");
  const [titleFilter, setTitleFilter] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", target_type: "group", target_net_ids: [], is_gradable: false, max_score: 100 });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [editItem, setEditItem] = useState(null);
  const [gradeItem, setGradeItem] = useState(null);
  const [gradeBatch, setGradeBatch] = useState(null);

  const fetchData = useCallback(async (currentScope) => {
    setLoading(true);
    const [meRes, itemsRes] = await Promise.all([
      fetch("/api/users/me"),
      fetch(`/api/action_items?scope=${currentScope}`),
    ]);
    if (meRes.ok) {
      const me = await meRes.json();
      setMyRecord(me);
      if (me?.group_number) {
        const stuRes = await fetch(`/api/users?role=STUDENT&group=${me.group_number}`);
        if (stuRes.ok) setStudents(await stuRes.json());
      }
    }
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData(scope);
  }, [status, fetchData, scope]);

  const handleToggle = async (id, is_done) => {
    await fetch(`/api/action_items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !is_done }),
    });
    await fetchData(scope);
  };

  const handleDelete = (id) => {
    const item = actionItems.find((i) => i.id === id);
    if (!item) return;
    setActionItems((prev) => prev.filter((i) => i.id !== id));
    scheduleUndo({
      message: `Deleted "${item.title}"`,
      onExpire: () => fetch(`/api/action_items/${id}`, { method: "DELETE" }),
      onCancel: () => setActionItems((prev) => [...prev, item]),
    });
  };

  const handleDeleteBatch = (batchId, batchItems) => {
    const ids = new Set(batchItems.map((i) => i.id));
    setActionItems((prev) => prev.filter((i) => !ids.has(i.id)));
    scheduleUndo({
      message: `Deleted "${batchItems[0]?.title}" for ${batchItems.length} people`,
      onExpire: () => fetch(`/api/action_items/batch/${batchId}`, { method: "DELETE" }),
      onCancel: () => setActionItems((prev) => [...prev, ...batchItems]),
    });
  };

  const handleCreate = async () => {
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (form.target_type === "individual" && form.target_net_ids.length === 0) {
      setFormError("Select at least one student."); return;
    }
    const payload = { ...form };
    if (form.target_type === "group") payload.target_group = myRecord?.group_number;
    setFormLoading(true);
    const res = await fetch("/api/action_items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setFormError(json.error || "Failed."); setFormLoading(false); return; }
    setFormSuccess(`Assigned to ${json.count} student${json.count !== 1 ? "s" : ""}.`);
    await fetchData(scope);
    setTimeout(() => {
      setShowModal(false);
      setFormSuccess("");
      setForm({ title: "", description: "", due_date: "", target_type: "group", target_net_ids: [], is_gradable: false, max_score: 100 });
    }, 1200);
    setFormLoading(false);
  };

  const allTitles = [...new Set(actionItems.map((i) => i.title))].sort();
  const studentsByNetId = Object.fromEntries(students.map((s) => [s.net_id, s]));
  const needsGradingCount = actionItems.filter(
    (a) => a.is_gradable && a.is_done && a.grade == null && (a.assigned_by || a.additional_info?.assigned_by) === myNetId
  ).length;
  const filteredItems = actionItems.filter((item) => {
    if (statusFilter === "needs_grading") {
      const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
      if (!(item.is_gradable && item.is_done && item.grade == null && assignedBy === myNetId)) return false;
    } else {
      if (statusFilter === "open" && item.is_done) return false;
      if (statusFilter === "done" && !item.is_done) return false;
    }
    if (titleFilter && item.title !== titleFilter) return false;
    return true;
  });

  const totalOpen = actionItems.filter((a) => !a.is_done).length;
  const totalDone = actionItems.filter((a) =>  a.is_done).length;

  const renderTitleGrouped = () => {
    if (filteredItems.length === 0) return <EmptyState icon="✅" message="No items match" />;
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Title</th><th>Assigned To</th><th>Assigned By</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredItems.map((item) => {
              const stu = students.find((s) => s.net_id === item.net_id);
              const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
              const canGrade = assignedBy === myNetId && item.is_gradable && item.is_done;
              const batchItems = item.batch_id ? actionItems.filter((i) => i.batch_id === item.batch_id) : null;
              return (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{item.net_id}</span>
                    {stu?.name && <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>{stu.name}</span>}
                  </td>
                  <td style={{ color: "rgba(249,249,249,0.5)", fontSize: "0.82rem", fontFamily: "monospace" }}>
                    {assignedBy || "-"}
                    {assignedBy === myNetId && <span style={{ marginLeft: "0.35rem", color: "#4f8dde", fontSize: "0.72rem" }}>(you)</span>}
                  </td>
                  <td style={{ color: "rgba(249,249,249,0.6)", fontSize: "0.85rem" }}>
                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : "-"}
                  </td>
                  <td><StatusBadge item={item} /></td>
                  <td>
                    <div className={styles.cellActions}>
                      <button className={`${styles.btnSmall} ${item.is_done ? styles.btnReopen : styles.btnComplete}`} onClick={() => handleToggle(item.id, item.is_done)}>
                        {item.is_done ? "Reopen" : "Complete"}
                      </button>
                      {canGrade && (
                        <button className={styles.btnSmall} style={{ background: "rgba(236,181,87,0.15)", color: "#ecb557", border: "1px solid rgba(236,181,87,0.25)" }} onClick={() => setGradeItem(item)}>
                          {item.grade != null ? "Edit Grade" : "Grade"}
                        </button>
                      )}
                      <button className={styles.btnSmall} style={{ background: "rgba(79,141,222,0.15)", color: "#4f8dde", border: "1px solid rgba(79,141,222,0.25)" }} onClick={() => setEditItem(item)}>Edit</button>
                      <button className={styles.btnDanger} onClick={() => handleDelete(item.id)}>Delete</button>
                      {batchItems && batchItems.length > 1 && (
                        <button
                          className={styles.btnDanger}
                          title={`Delete this item for all ${batchItems.length} recipients it was assigned to`}
                          onClick={() => handleDeleteBatch(item.batch_id, batchItems)}
                        >
                          Delete Batch ({batchItems.length})
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStudentGrouped = () => {
    const itemsByNetId = filteredItems.reduce((acc, item) => {
      (acc[item.net_id] = acc[item.net_id] || []).push(item);
      return acc;
    }, {});
    const allNetIds = [...new Set([...students.map((s) => s.net_id), ...Object.keys(itemsByNetId)])];
    const rows = allNetIds
      .map((net_id) => {
        const stu = students.find((s) => s.net_id === net_id) || { net_id, name: null };
        const items = itemsByNetId[net_id] || [];
        const open = items.filter((i) => !i.is_done).length;
        return { ...stu, items, open };
      })
      .filter((r) => r.items.length > 0)
      .sort((a, b) => b.open - a.open);

    if (rows.length === 0) return (
      <EmptyState
        icon={statusFilter === "open" ? "✅" : "📭"}
        message={statusFilter === "open" ? "No pending items - great work!" : "No items here yet"}
      />
    );

    return rows.map((row) => (
      <PersonAccordion
        key={row.net_id}
        netId={row.net_id}
        user={row}
        openCount={row.open}
        totalCount={row.items.length}
        isCollapsed={collapsed[row.net_id]}
        onToggle={() => setCollapsed((c) => ({ ...c, [row.net_id]: !c[row.net_id] }))}
        showRole={false}
      >
        <div className={styles.tableWrapper} style={{ marginTop: "0.25rem" }}>
          <table className={styles.table}>
            <thead><tr><th>Title</th><th>Assigned By</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {row.items.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  myNetId={myNetId}
                  onToggle={handleToggle}
                  onEdit={setEditItem}
                  onDelete={handleDelete}
                  onGrade={setGradeItem}
                  onDeleteBatch={handleDeleteBatch}
                  allItems={actionItems}
                />
              ))}
            </tbody>
          </table>
        </div>
      </PersonAccordion>
    ));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Group Action Items</h1>
        <p>Group {myRecord?.group_number ?? "-"}</p>
      </div>

      <div className={styles.statsGrid}>
        {[{ label: "Open", val: totalOpen }, { label: "Completed", val: totalDone }, { label: "Students", val: students.length }].map(({ label, val }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statNumber}>{val}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className={styles.filterChips}>
              <button className={`${styles.chip} ${scope === "mine" ? styles.activeChip : ""}`} onClick={() => setScope("mine")}>My Items</button>
              <button className={`${styles.chip} ${scope === "all"  ? styles.activeChip : ""}`} onClick={() => setScope("all")}>All Group Items</button>
            </div>
            <button className={styles.btnPrimary} onClick={() => setShowModal(true)} disabled={!myRecord?.group_number}>
              + Assign to Group
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div className={styles.filterChips}>
              {[{ key: "open", label: `Open (${totalOpen})` }, { key: "done", label: `Done (${totalDone})` }, { key: "all", label: `All (${actionItems.length})` }].map(({ key, label }) => (
                <button key={key} className={`${styles.chip} ${statusFilter === key ? styles.activeChip : ""}`} onClick={() => setStatusFilter(key)}>{label}</button>
              ))}
              <button
                className={`${styles.chip} ${statusFilter === "needs_grading" ? styles.activeChip : ""}`}
                onClick={() => setStatusFilter("needs_grading")}
                style={needsGradingCount > 0 && statusFilter !== "needs_grading" ? { borderColor: "rgba(236,181,87,0.5)", color: "#ecb557" } : undefined}
              >
                Needs Grading{needsGradingCount > 0 ? ` (${needsGradingCount})` : ""}
              </button>
            </div>
            <select className={styles.roleSelect} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} style={{ minWidth: 180, flex: 1 }}>
              <option value="">All action items</option>
              {allTitles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Title</th><th>Assigned By</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "70%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "45%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "35%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "30%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "1.5rem", width: "65%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : statusFilter === "needs_grading" ? (
          <NeedsGradingList
            items={filteredItems}
            allItems={actionItems}
            peopleByNetId={studentsByNetId}
            onGradeSingle={setGradeItem}
            onGradeBatch={(batchId, batchItems) => setGradeBatch({ batchId, items: batchItems })}
            onDeleteBatch={handleDeleteBatch}
          />
        ) : titleFilter ? renderTitleGrouped() : renderStudentGrouped()}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2>Assign Action Item</h2>
          {formError && <div className={styles.alertError}>{formError}</div>}
          {formSuccess && <div className={styles.alertSuccess}>{formSuccess}</div>}
          <div className={styles.formGroup}>
            <label>Title <span className={styles.required}>*</span></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Action item…" />
          </div>
          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details…" />
          </div>
          <div className={styles.formGroup}>
            <label>Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className={styles.formGroup}>
            <label>Assign To</label>
            <select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value, target_net_ids: [] })}>
              <option value="group">Entire Group ({students.length} students)</option>
              <option value="individual">Specific Students</option>
            </select>
          </div>
          {form.target_type === "individual" && (
            <div className={styles.formGroup}>
              <label>Students <span className={styles.required}>*</span></label>
              <PeopleMultiSelect
                people={students}
                selected={form.target_net_ids}
                onChange={(ids) => setForm({ ...form, target_net_ids: ids })}
              />
            </div>
          )}
          <div style={{ marginBottom: "1rem" }}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={form.is_gradable}
                onChange={(e) => setForm({ ...form, is_gradable: e.target.checked })}
              />
              Gradable
            </label>
          </div>
          {form.is_gradable && (
            <div className={styles.formGroup}>
              <label>Max Score</label>
              <input type="number" min="1" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} placeholder="100" />
            </div>
          )}
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleCreate} disabled={formLoading}>{formLoading ? "Assigning…" : "Assign"}</button>
          </div>
        </Modal>
      )}

      {editItem && (
        <EditActionItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => fetchData(scope)}
        />
      )}

      {gradeItem && (
        <GradeActionItemModal
          item={gradeItem}
          onClose={() => setGradeItem(null)}
          onSaved={() => fetchData(scope)}
        />
      )}

      {gradeBatch && (
        <BatchGradeModal
          batchId={gradeBatch.batchId}
          items={gradeBatch.items}
          peopleByNetId={studentsByNetId}
          onClose={() => setGradeBatch(null)}
          onSaved={() => fetchData(scope)}
        />
      )}
    </div>
  );
}
