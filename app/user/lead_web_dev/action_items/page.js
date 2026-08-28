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
import EmptyState from "../../components/EmptyState";

export default function LeadWebDevActionItems() {
  const { data: session } = useSession();
  const myNetId = session?.user?.netID;
  const { scheduleUndo } = useUndo();

  const [actionItems, setActionItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scope,        setScope]        = useState("mine");
  const [statusFilter, setStatusFilter] = useState("open");
  const [titleFilter,  setTitleFilter]  = useState("");
  const [search,       setSearch]       = useState("");
  const [collapsed,    setCollapsed]    = useState({});

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", due_date: "",
    target_type: "individual", target_net_ids: [], target_group: "",
    is_gradable: false, max_score: 100,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [editItem, setEditItem] = useState(null);
  const [gradeItem, setGradeItem] = useState(null);
  const [gradeBatch, setGradeBatch] = useState(null);

  const fetchData = useCallback(async (currentScope) => {
    setLoading(true);
    const [itemsRes, usersRes, rolesRes] = await Promise.all([
      fetch(`/api/action_items?scope=${currentScope}`),
      fetch("/api/users"),
      fetch("/api/roles?manageable=true"),
    ]);
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(scope); }, [fetchData, scope]);

  const userByNetId = Object.fromEntries(users.map((u) => [u.net_id, u]));
  const openCount = actionItems.filter((a) => !a.is_done).length;
  const doneCount = actionItems.filter((a) =>  a.is_done).length;
  const allTitles = [...new Set(actionItems.map((i) => i.title))].sort();
  const needsGradingCount = actionItems.filter(
    (a) => a.is_gradable && a.is_done && a.grade == null && (a.assigned_by || a.additional_info?.assigned_by) === myNetId
  ).length;
  const roleLabel = (id) => roles.find((r) => r.id === id)?.label ?? id;
  const roleOrderMap = Object.fromEntries(roles.map((r) => [r.id, r.order]));
  const manageableIds = roles.map((r) => r.id);
  const webDevs = users.filter((u) => manageableIds.includes(u.role));

  const filteredItems = actionItems.filter((item) => {
    if (statusFilter === "needs_grading") {
      const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
      if (!(item.is_gradable && item.is_done && item.grade == null && assignedBy === myNetId)) return false;
    } else {
      if (statusFilter === "open" && item.is_done) return false;
      if (statusFilter === "done" && !item.is_done) return false;
    }
    if (titleFilter && item.title !== titleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const u = userByNetId[item.net_id];
      const assignedBy = item.assigned_by || item.additional_info?.assigned_by || "";
      if (!item.title.toLowerCase().includes(q) && !item.net_id.toLowerCase().includes(q) && !u?.name?.toLowerCase().includes(q) && !assignedBy.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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
      setFormError("Select at least one person."); return;
    }
    setFormLoading(true);
    const res = await fetch("/api/action_items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setFormError(json.error || "Failed to create action item."); setFormLoading(false); return; }
    setFormSuccess(`Assigned to ${json.count} person${json.count !== 1 ? "s" : ""}.`);
    await fetchData(scope);
    setTimeout(() => {
      setShowModal(false);
      setFormSuccess("");
      setForm({ title: "", description: "", due_date: "", target_type: "individual", target_net_ids: [], target_group: "", is_gradable: false, max_score: 100 });
    }, 1200);
    setFormLoading(false);
  };

  const renderGrouped = () => {
    const grouped = filteredItems.reduce((acc, item) => {
      (acc[item.net_id] = acc[item.net_id] || []).push(item);
      return acc;
    }, {});
    const netIds = Object.keys(grouped).sort((a, b) => {
      const ua = userByNetId[a], ub = userByNetId[b];
      const roleA = roleOrderMap[ua?.role] ?? 99;
      const roleB = roleOrderMap[ub?.role] ?? 99;
      if (roleA !== roleB) return roleA - roleB;
      return (ua?.name || a).localeCompare(ub?.name || b);
    });
    if (netIds.length === 0) return <EmptyState icon="✅" message="No action items match your filters" />;
    return netIds.map((net_id) => {
      const u = userByNetId[net_id];
      const items = grouped[net_id];
      const openItems = items.filter((i) => !i.is_done).length;
      return (
        <PersonAccordion
          key={net_id}
          netId={net_id}
          user={u}
          openCount={openItems}
          totalCount={items.length}
          isCollapsed={collapsed[net_id]}
          onToggle={() => setCollapsed((c) => ({ ...c, [net_id]: !c[net_id] }))}
        >
          <div className={styles.tableWrapper} style={{ marginTop: "0.25rem" }}>
            <table className={styles.table}>
              <thead><tr><th>Title</th><th>Assigned By</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((item) => (
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
      );
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Action Items</h1>
        <p>{openCount} open · {doneCount} completed</p>
      </div>

      <div className={styles.panel}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className={styles.filterChips}>
              <button className={`${styles.chip} ${scope === "mine" ? styles.activeChip : ""}`} onClick={() => setScope("mine")}>My Items</button>
              <button className={`${styles.chip} ${scope === "all"  ? styles.activeChip : ""}`} onClick={() => setScope("all")}>All Items</button>
            </div>
            <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>+ Assign Action Item</button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className={styles.filterChips}>
              {[{ key: "open", label: `Open (${openCount})` }, { key: "done", label: `Done (${doneCount})` }, { key: "all", label: `All (${actionItems.length})` }].map(({ key, label }) => (
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
            <select className={styles.roleSelect} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} style={{ minWidth: 200, flex: 1 }}>
              <option value="">All action items</option>
              {allTitles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={styles.searchBar} placeholder="Search title, person, or assigner…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 2, minWidth: 160 }} />
          </div>
        </div>

        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Title</th><th>Assigned To</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j}><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: j === 4 ? "70%" : "60%" }} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : statusFilter === "needs_grading" ? (
          <NeedsGradingList
            items={filteredItems}
            allItems={actionItems}
            peopleByNetId={userByNetId}
            onGradeSingle={setGradeItem}
            onGradeBatch={(batchId, batchItems) => setGradeBatch({ batchId, items: batchItems })}
            onDeleteBatch={handleDeleteBatch}
          />
        ) : renderGrouped()}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2>Assign Action Item</h2>
          {formError && <div className={styles.alertError}>{formError}</div>}
          {formSuccess && <div className={styles.alertSuccess}>{formSuccess}</div>}
          <div className={styles.formGroup}><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" /></div>
          <div className={styles.formGroup}><label>Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details…" /></div>
          <div className={styles.formGroup}><label>Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className={styles.formGroup}>
            <label>Assign To</label>
            <select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value, target_net_ids: [], target_group: "" })}>
              <option value="individual">Specific People</option>
              {roles.map((r) => <option key={r.id} value={`role_${r.id}`}>All {r.label}s</option>)}
            </select>
          </div>
          {form.target_type === "individual" && (
            <div className={styles.formGroup}>
              <label>People</label>
              <PeopleMultiSelect
                people={webDevs}
                selected={form.target_net_ids}
                onChange={(ids) => setForm({ ...form, target_net_ids: ids })}
                roleLabelFn={roleLabel}
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
          peopleByNetId={userByNetId}
          onClose={() => setGradeBatch(null)}
          onSaved={() => fetchData(scope)}
        />
      )}
    </div>
  );
}
