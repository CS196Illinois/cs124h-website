"use client";

import { useState, useEffect, useCallback } from "react";
import { useUndo } from "../../../../components/UndoProvider";
import styles from "../../dashboard.module.css";
import Modal from "../../components/Modal";
import RoleBadge from "../../components/RoleBadge";
import { ALL_ROLES } from "../../../../lib/roles";
import { downloadCsv } from "../../../../lib/csvExport";

const MANAGED_ROLE_IDS = ["PM", "STUDENT"];
const managedRoles = ALL_ROLES.filter((r) => MANAGED_ROLE_IDS.includes(r.id));
const roleOrder = Object.fromEntries(managedRoles.map((r) => [r.id, r.order]));

function sortUsers(users, key, dir) {
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
    if (key === "role") return mul * ((roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99));
    if (key === "group_number") return mul * ((a.group_number ?? Infinity) - (b.group_number ?? Infinity));
    return 0;
  });
}

export default function HeadPMPeople() {
  const { scheduleUndo } = useUndo();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", net_id: "", role: "STUDENT", group_number: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", group_number: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      const all = await res.json();
      setUsers(all.filter((u) => MANAGED_ROLE_IDS.includes(u.role)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredUsers = sortUsers(
    users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      const q = search.toLowerCase();
      return !q || u.net_id.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
    }),
    sortKey, sortDir
  );

  const handleAddUser = async () => {
    setAddError("");
    if (!addForm.net_id.trim()) { setAddError("NetID is required."); return; }
    setAddLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        net_id: addForm.net_id.trim().toLowerCase(),
        role: addForm.role,
        name: addForm.name.trim() || null,
        group_number: addForm.role === "STUDENT" && addForm.group_number ? Number(addForm.group_number) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setAddError(json.error || "Failed to add user."); setAddLoading(false); return; }
    await fetchUsers();
    setShowAddModal(false);
    setAddForm({ name: "", net_id: "", role: "STUDENT", group_number: "" });
    setAddLoading(false);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name || "", group_number: user.group_number ?? "" });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    setEditError("");
    setEditLoading(true);
    const res = await fetch(`/api/users/${encodeURIComponent(editUser.net_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim() || null,
        ...(editUser.role === "STUDENT" && { group_number: editForm.group_number ? Number(editForm.group_number) : null }),
      }),
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
      message: `Removed ${user.name || net_id}`,
      onExpire: () => fetch(`/api/users/${encodeURIComponent(net_id)}`, { method: "DELETE" }),
      onCancel: () => setUsers((prev) => [...prev, user]),
    });
  };

  const sortIcon = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.25 }}>↕</span>;
    return sortDir === "asc" ? "↑" : "↓";
  };

  const roleLabel = (id) => managedRoles.find((r) => r.id === id)?.label ?? id;

  const handleExport = () => {
    const scope = roleFilter === "ALL" ? "people" : roleLabel(roleFilter).toLowerCase().replace(/\s+/g, "-");
    downloadCsv(
      `${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "name", label: "Name" },
        { key: "net_id", label: "NetID" },
        { key: "role", label: "Role", value: (u) => roleLabel(u.role) },
        { key: "group_number", label: "Group" },
      ],
      filteredUsers,
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>People</h1>
        <p>{users.length} total member{users.length !== 1 ? "s" : ""}</p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : managedRoles.map((r) => (
              <div key={r.id} className={styles.statCard}>
                <div className={styles.statNumber}>{users.filter((u) => u.role === r.id).length}</div>
                <div className={styles.statLabel}>{r.label}</div>
              </div>
            ))
        }
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.filterChips}>
              {["ALL", ...managedRoles.map((r) => r.id)].map((id) => (
                <button
                  key={id}
                  className={`${styles.chip} ${roleFilter === id ? styles.activeChip : ""}`}
                  onClick={() => setRoleFilter(id)}
                >
                  {id === "ALL" ? "All" : roleLabel(id)}
                </button>
              ))}
            </div>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchBar}
                placeholder="Search name or NetID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch("")} aria-label="Clear search">×</button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className={styles.btnSecondary} onClick={handleExport} disabled={filteredUsers.length === 0}>
              Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => setShowAddModal(true)}>+ Add Person</button>
          </div>
        </div>

        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>NetID</th><th>Role</th><th>Group</th><th>Actions</th></tr></thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "65%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "55%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "1.1rem", width: "45%", borderRadius: "20px" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: "30%" }} /></td>
                    <td><div className={styles.skeletonBlock} style={{ height: "1.5rem", width: "80%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>👤</span>No users found
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    { key: "name",         label: "Name"  },
                    { key: "net_id",       label: "NetID" },
                    { key: "role",         label: "Role"  },
                    { key: "group_number", label: "Group" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      {label}
                      <span style={{ marginLeft: "0.4rem", opacity: sortKey === key ? 1 : 0.25, fontSize: "0.75rem" }}>
                        {sortIcon(key)}
                      </span>
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.net_id}>
                    <td>{u.name || <span style={{ opacity: 0.4 }}>-</span>}</td>
                    <td className={styles.cellMono}>{u.net_id}</td>
                    <td><RoleBadge roleId={u.role} /></td>
                    <td>{u.group_number || <span style={{ opacity: 0.4 }}>-</span>}</td>
                    <td>
                      <div className={styles.cellActions}>
                        <button
                          className={styles.btnSmall}
                          style={{ background: "rgba(79,141,222,0.15)", color: "#4f8dde", border: "1px solid rgba(79,141,222,0.25)" }}
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
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
          <h2>Add Person</h2>
          {addError && <div className={styles.alertError}>{addError}</div>}
          <div className={styles.formGroup}>
            <label>Full Name</label>
            <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className={styles.formGroup}>
            <label>NetID <span className={styles.required}>*</span></label>
            <input value={addForm.net_id} onChange={(e) => setAddForm({ ...addForm, net_id: e.target.value })} placeholder="jdoe2" />
          </div>
          <div className={styles.formGroup}>
            <label>Role <span className={styles.required}>*</span></label>
            <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
              {managedRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          {addForm.role === "STUDENT" && (
            <div className={styles.formGroup}>
              <label>Group Number</label>
              <input type="number" value={addForm.group_number} onChange={(e) => setAddForm({ ...addForm, group_number: e.target.value })} placeholder="e.g. 3" />
            </div>
          )}
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleAddUser} disabled={addLoading}>
              {addLoading ? "Adding…" : "Add Person"}
            </button>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal onClose={() => setEditUser(null)}>
          <h2>Edit {editUser.net_id}</h2>
          {editError && <div className={styles.alertError}>{editError}</div>}
          <div className={styles.formGroup}>
            <label>Full Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          {editUser.role === "STUDENT" && (
            <div className={styles.formGroup}>
              <label>Group Number</label>
              <input type="number" value={editForm.group_number} onChange={(e) => setEditForm({ ...editForm, group_number: e.target.value })} placeholder="e.g. 3" />
            </div>
          )}
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={() => setEditUser(null)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
