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

export default function CourseLeadActionItems() {
  const { data: session } = useSession();
  const myNetId = session?.user?.netID;
  const { scheduleUndo } = useUndo();

  const [actionItems, setActionItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scope,        setScope]        = useState("mine");
  const [roleFilter,   setRoleFilter]   = useState("ALL");
  const [groupFilter,  setGroupFilter]  = useState("ALL");
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
      fetch("/api/roles"),
    ]);
    if (itemsRes.ok) setActionItems(await itemsRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(scope); }, [fetchData, scope]);

  const userByNetId = Object.fromEntries(users.map((u) => [u.net_id, u]));
  const roleLabel = (id) => roles.find((r) => r.id === id)?.label ?? id;
  const roleOrderMap = Object.fromEntries(roles.map((r) => [r.id, r.order]));
  const groups = [...new Set(users.filter((u) => u.group_number).map((u) => u.group_number))].sort((a, b) => a - b);
  const openCount = actionItems.filter((a) => !a.is_done).length;
  const doneCount = actionItems.filter((a) =>  a.is_done).length;
  const allTitles = [...new Set(actionItems.map((i) => i.title))].sort();
  const needsGradingCount = actionItems.filter(
    (a) => a.is_gradable && a.is_done && a.grade == null && (a.assigned_by || a.additional_info?.assigned_by) === myNetId
  ).length;

  const summaryRoles = roles.filter((r) => r.id !== "LEAD" && r.id !== "LEAD_WEB");
  const roleSummary = summaryRoles.map((r) => ({
    role: r.id,
    open:  actionItems.filter((a) => !a.is_done && userByNetId[a.net_id]?.role === r.id).length,
    total: actionItems.filter((a) => userByNetId[a.net_id]?.role === r.id).length,
  }));

  const filteredItems = actionItems.filter((item) => {
    const u = userByNetId[item.net_id];
    if (roleFilter  !== "ALL" && u?.role !== roleFilter) return false;
    if (groupFilter !== "ALL" && String(u?.group_number) !== groupFilter) return false;
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
    if (form.target_type === "group" && !form.target_group) {
      setFormError("Select a group."); return;
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

  const renderTitleGrouped = () => {
    if (filteredItems.length === 0) return <EmptyState icon="✅" message="No items match your filters" />;
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr><th>Title</th><th>Assigned To</th><th>Role</th><th>Group</th><th>Assigned By</th><th>Due</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const u = userByNetId[item.net_id];
              const assignedBy = item.assigned_by || item.additional_info?.assigned_by;
              const canGrade = assignedBy === myNetId && item.is_gradable && item.is_done;
              const batchItems = item.batch_id ? actionItems.filter((i) => i.batch_id === item.batch_id) : null;
              return (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{item.net_id}</span>
                    {u?.name && <span style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>{u.name}</span>}
                  </td>
                  <td style={{ color: "rgba(249,249,249,0.5)", fontSize: "0.8rem" }}>{u?.role ? roleLabel(u.role) : "-"}</td>
                  <td style={{ color: "rgba(249,249,249,0.5)", fontSize: "0.82rem" }}>{u?.group_number || "-"}</td>
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

  const renderPersonGrouped = () => {
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
          showGroup
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

      {scope === "all" && (
        <div className={styles.statsGrid}>
          {roleSummary.map(({ role, open, total }) => (
            <div
              key={role}
              className={styles.statCard}
              style={{ cursor: "pointer", outline: roleFilter === role ? "2px solid rgba(79,141,222,0.6)" : "none" }}
              onClick={() => setRoleFilter((r) => r === role ? "ALL" : role)}
            >
              <div className={styles.statNumber}>{open}</div>
              <div className={styles.statLabel}>{roleLabel(role)} open</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(249,249,249,0.35)", marginTop: "0.15rem" }}>{total} total</div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.panel}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className={styles.filterChips}>
              <button className={`${styles.chip} ${scope === "mine" ? styles.activeChip : ""}`} onClick={() => { setScope("mine"); setRoleFilter("ALL"); setGroupFilter("ALL"); }}>My Items</button>
              <button className={`${styles.chip} ${scope === "all"  ? styles.activeChip : ""}`} onClick={() => setScope("all")}>All Items</button>
            </div>
            <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>+ Assign Action Item</button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
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
            {scope === "all" && (
              <>
                <div className={styles.filterChips}>
                  {["ALL", ...roles.map((r) => r.id)].map((id) => (
                    <button key={id} className={`${styles.chip} ${roleFilter === id ? styles.activeChip : ""}`} onClick={() => setRoleFilter(id)}>
                      {id === "ALL" ? "All Roles" : roleLabel(id)}
                    </button>
                  ))}
                </div>
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={styles.roleSelect} style={{ minWidth: 120 }}>
                  <option value="ALL">All Groups</option>
                  {groups.map((g) => <option key={g} value={String(g)}>Group {g}</option>)}
                </select>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "70%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "50%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "40%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "35%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "1.5rem", width: "70%" }} /></td>
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
        ) : titleFilter ? renderTitleGrouped() : renderPersonGrouped()}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2>Assign Action Item</h2>
          {formError && <div className={styles.alertError}>{formError}</div>}
          {formSuccess && <div className={styles.alertSuccess}>{formSuccess}</div>}
          <div className={styles.formGroup}>
            <label>Title <span className={styles.required}>*</span></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Complete project proposal" />
          </div>
          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Any additional details…" />
          </div>
          <div className={styles.formGroup}>
            <label>Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className={styles.formGroup}>
            <label>Assign To</label>
            <select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value, target_net_ids: [], target_group: "" })}>
              <option value="individual">Specific People</option>
              {roles.filter((r) => r.id !== "LEAD").map((r) => (
                <option key={r.id} value={`role_${r.id}`}>All {r.label}s</option>
              ))}
              <option value="group">Student Group</option>
            </select>
          </div>
          {form.target_type === "individual" && (
            <div className={styles.formGroup}>
              <label>People <span className={styles.required}>*</span></label>
              <PeopleMultiSelect
                people={users}
                selected={form.target_net_ids}
                onChange={(ids) => setForm({ ...form, target_net_ids: ids })}
                roleLabelFn={roleLabel}
              />
            </div>
          )}
          {form.target_type === "group" && (
            <div className={styles.formGroup}>
              <label>Group Number <span className={styles.required}>*</span></label>
              <select value={form.target_group} onChange={(e) => setForm({ ...form, target_group: e.target.value })}>
                <option value="">Select a group…</option>
                {groups.map((g) => <option key={g} value={g}>Group {g}</option>)}
              </select>
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
