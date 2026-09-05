"use client";

import { useState, useEffect, useCallback } from "react";
import { useUndo } from "../../../../components/UndoProvider";
import styles from "../../dashboard.module.css";
import Modal from "../../components/Modal";
import RoleBadge from "../../components/RoleBadge";
import { downloadCsv } from "../../../../lib/csvExport";

function sortUsers(users, roleOrderMap, key, dir) {
  const mul = dir === "asc" ? 1 : -1;
  return [...users].sort((a, b) => {
    if (key === "name") {
      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;
      return mul * na.localeCompare(nb);
    }
    if (key === "net_id") return mul * a.net_id.localeCompare(b.net_id);
    if (key === "role") return mul * ((roleOrderMap[a.role] ?? 99) - (roleOrderMap[b.role] ?? 99));
    return 0;
  });
}

export default function LeadWebDevPeople() {
  const { scheduleUndo } = useUndo();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", net_id: "", role: "WEB" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", role: "WEB" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles?manageable=true"),
    ]);
    let fetchedRoles = [];
    if (rolesRes.ok) { fetchedRoles = await rolesRes.json(); setRoles(fetchedRoles); }
    if (usersRes.ok) {
      const all = await usersRes.json();
      setUsers(fetchedRoles.length ? all.filter((u) => fetchedRoles.some((r) => r.id === u.role)) : all);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const roleLabel = (id) => roles.find((r) => r.id === id)?.label ?? id;
  const roleOrderMap = Object.fromEntries(roles.map((r) => [r.id, r.order]));

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleAdd = async () => {
    setAddError("");
    if (!addForm.net_id.trim()) { setAddError("NetID is required."); return; }
    if (!roles.some((r) => r.id === addForm.role)) { setAddError("Invalid role."); return; }
    setAddLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ net_id: addForm.net_id.trim().toLowerCase(), role: addForm.role, name: addForm.name.trim() || null }),
    });
    const json = await res.json();
    if (!res.ok) { setAddError(json.error || "Failed to add user."); setAddLoading(false); return; }
    setShowAddModal(false);
    setAddForm({ name: "", net_id: "", role: roles[0]?.id || "WEB" });
    setAddLoading(false);
    await fetchUsers();
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name || "", role: user.role });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    setEditError("");
    if (!roles.some((r) => r.id === editForm.role)) { setEditError("Invalid role."); return; }
    setEditLoading(true);
    const res = await fetch(`/api/users/${editUser.net_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim() || null, role: editForm.role }),
    });
    const json = await res.json();
    if (!res.ok) { setEditError(json.error || "Failed to update."); setEditLoading(false); return; }
    setEditUser(null);
    setEditLoading(false);
    await fetchUsers();
  };

  const handleRemove = (net_id) => {
    const user = users.find((u) => u.net_id === net_id);
    if (!user) return;
    setUsers((prev) => prev.filter((u) => u.net_id !== net_id));
    scheduleUndo({
      message: `Removed ${user.name || net_id} from the web dev team`,
      onExpire: () => fetch(`/api/users/${net_id}`, { method: "DELETE" }),
      onCancel: () => setUsers((prev) => [...prev, user]),
    });
  };

  const sortIcon = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.25 }}>↕</span>;
    return sortDir === "asc" ? "↑" : "↓";
  };

  const filtered = sortUsers(
    users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.net_id.toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q);
      }
      return true;
    }),
    roleOrderMap, sortKey, sortDir
  );

  const handleExport = () => {
    const scope = roleFilter === "ALL" ? "web-dev-team" : roleLabel(roleFilter).toLowerCase().replace(/\s+/g, "-");
    downloadCsv(
      `${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "name", label: "Name" },
        { key: "net_id", label: "NetID" },
        { key: "role", label: "Role", value: (u) => roleLabel(u.role) },
      ],
      filtered,
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Web Dev Team</h1>
        <p>{users.length} member{users.length !== 1 ? "s" : ""}</p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : roles.map((r) => (
              <div key={r.id} className={styles.statCard}>
                <div className={styles.statNumber}>{users.filter((u) => u.role === r.id).length}</div>
                <div className={styles.statLabel}>{r.label}</div>
              </div>
            ))
        }
      </div>

      <div className={styles.panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div className={styles.filterChips}>
              {["ALL", ...roles.map((r) => r.id)].map((id) => (
                <button key={id} className={`${styles.chip} ${roleFilter === id ? styles.activeChip : ""}`} onClick={() => setRoleFilter(id)}>
                  {id === "ALL" ? "All" : roleLabel(id)}
                </button>
              ))}
            </div>
            <input className={styles.searchBar} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className={styles.btnSecondary} onClick={handleExport} disabled={filtered.length === 0}>
              Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => setShowAddModal(true)}>+ Add Member</button>
          </div>
        </div>

        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}><thead><tr><th>Name</th><th>NetID</th><th>Role</th><th>Actions</th></tr></thead>
              <tbody>{Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[70, 50, 30, 60].map((w, j) => <td key={j}><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: `${w}%` }} /></td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}><span className={styles.emptyIcon}>👥</span>No members found</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>Name {sortIcon("name")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("net_id")}>NetID {sortIcon("net_id")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("role")}>Role {sortIcon("role")}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.net_id}>
                    <td>{u.name || <span style={{ opacity: 0.4 }}>-</span>}</td>
                    <td className={styles.cellMono}>{u.net_id}</td>
                    <td><RoleBadge roleId={u.role} /></td>
                    <td>
                      <div className={styles.cellActions}>
                        <button className={styles.btnSmall} style={{ background: "rgba(79,141,222,0.15)", color: "#4f8dde", border: "1px solid rgba(79,141,222,0.25)" }} onClick={() => openEdit(u)}>Edit</button>
                        <button className={styles.btnDanger} onClick={() => handleRemove(u.net_id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <h2>Add Web Dev Member</h2>
          {addError && <div className={styles.alertError}>{addError}</div>}
          <div className={styles.formGroup}><label>Name</label><input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Jane Doe" /></div>
          <div className={styles.formGroup}><label>NetID <span className={styles.required}>*</span></label><input value={addForm.net_id} onChange={(e) => setAddForm({ ...addForm, net_id: e.target.value })} placeholder="jdoe2" /></div>
          <div className={styles.formGroup}>
            <label>Role <span className={styles.required}>*</span></label>
            <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleAdd} disabled={addLoading}>{addLoading ? "Adding…" : "Add"}</button>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal onClose={() => setEditUser(null)}>
          <h2>Edit {editUser.net_id}</h2>
          {editError && <div className={styles.alertError}>{editError}</div>}
          <div className={styles.formGroup}><label>Name</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Jane Doe" /></div>
          <div className={styles.formGroup}>
            <label>Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={() => setEditUser(null)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={editLoading}>{editLoading ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
