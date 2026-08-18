"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../../dashboard.module.css";
import ImportModal from "../../../../components/ImportModal";
import Modal from "../../components/Modal";
import RoleBadge from "../../components/RoleBadge";
import { downloadCsv } from "../../../../lib/csvExport";

function sortUsers(users, roleOrder, key, dir) {
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
    if (key === "group_number") {
      const ga = a.group_number ?? Infinity;
      const gb = b.group_number ?? Infinity;
      return mul * (ga - gb);
    }
    return 0;
  });
}

export default function CourseLeadPeople() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRoleScope, setImportRoleScope] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", net_id: "", role: "STUDENT", group_number: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles"),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const roleLabel = (id) => roles.find((r) => r.id === id)?.label ?? id;
  const roleOrder = Object.fromEntries(roles.map((r) => [r.id, r.order]));

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredUsers = sortUsers(
    users.filter((u) => {
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || u.net_id.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
      return matchRole && matchSearch;
    }),
    roleOrder,
    sortKey,
    sortDir,
  );

  const handleAddUser = async () => {
    setAddError("");
    if (!addForm.net_id.trim() || !addForm.role) { setAddError("NetID and role are required."); return; }
    setAddLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const json = await res.json();
    if (!res.ok) { setAddError(json.error || "Failed to add user."); setAddLoading(false); return; }
    await fetchAll();
    setShowAddModal(false);
    setAddForm({ name: "", net_id: "", role: "STUDENT", group_number: "" });
    setAddLoading(false);
  };

  const handleRemoveUser = async (net_id) => {
    if (!confirm(`Remove ${net_id} from the course?`)) return;
    await fetch(`/api/users/${encodeURIComponent(net_id)}`, { method: "DELETE" });
    await fetchAll();
  };

  const handleRoleChange = async (net_id, role) => {
    await fetch(`/api/users/${encodeURIComponent(net_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await fetchAll();
  };

  const handleDeleteCategory = async (role) => {
    const label = roleLabel(role);
    const count = users.filter((u) => u.role === role).length;
    if (!confirm(`Delete all ${count} ${label}${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    await fetch(`/api/users?role=${encodeURIComponent(role)}`, { method: "DELETE" });
    await fetchAll();
  };

  const handleGroupChange = async (net_id, group_number) => {
    await fetch(`/api/users/${encodeURIComponent(net_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_number: group_number ? Number(group_number) : null }),
    });
    await fetchAll();
  };

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

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.filterChips}>
              {["ALL", ...roles.map((r) => r.id)].map((id) => (
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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {roleFilter !== "ALL" && (
              <>
                <button
                  className={styles.btnSecondary}
                  onClick={() => { setImportRoleScope(roleFilter); setShowImportModal(true); }}
                >
                  Replace {roleLabel(roleFilter)}s
                </button>
                <button
                  className={styles.btnDanger}
                  onClick={() => handleDeleteCategory(roleFilter)}
                >
                  Delete All {roleLabel(roleFilter)}s
                </button>
              </>
            )}
            <button className={styles.btnSecondary} onClick={() => { setImportRoleScope(null); setShowImportModal(true); }}>
              Import CSV / Sheets
            </button>
            <button className={styles.btnSecondary} onClick={handleExport} disabled={filteredUsers.length === 0}>
              Export CSV
            </button>
            <button className={styles.btnPrimary} onClick={() => setShowAddModal(true)}>
              + Add Person
            </button>
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
                    <td><div className={styles.skeletonBlock} style={{ height: "1.1rem", width: "50%", borderRadius: "20px" }} /></td>
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
                    { key: "name",         label: "Name" },
                    { key: "net_id",       label: "NetID" },
                    { key: "role",         label: "Role" },
                    { key: "group_number", label: "Group" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      {label}
                      <span style={{ marginLeft: "0.4rem", opacity: sortKey === key ? 1 : 0.25, fontSize: "0.75rem" }}>
                        {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
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
                        <select
                          className={styles.roleSelect}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.net_id, e.target.value)}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className={styles.roleSelect}
                          style={{ width: 70 }}
                          placeholder="Grp"
                          defaultValue={u.group_number || ""}
                          onBlur={(e) => handleGroupChange(u.net_id, e.target.value)}
                        />
                        <button className={styles.btnDanger} onClick={() => handleRemoveUser(u.net_id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => { setShowImportModal(false); setImportRoleScope(null); }}
          onComplete={fetchAll}
          roleScope={importRoleScope}
        />
      )}

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
            <h2>Add Person</h2>
            {addError && <div className={styles.alertError}>{addError}</div>}
            <div className={styles.formGroup}>
              <label>Full Name</label>
              <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className={styles.formGroup}>
              <label>NetID *</label>
              <input value={addForm.net_id} onChange={(e) => setAddForm({ ...addForm, net_id: e.target.value })} placeholder="jdoe2" />
            </div>
            <div className={styles.formGroup}>
              <label>Role *</label>
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Group Number</label>
              <input type="number" value={addForm.group_number} onChange={(e) => setAddForm({ ...addForm, group_number: e.target.value })} placeholder="e.g. 3" />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAddUser} disabled={addLoading}>
                {addLoading ? "Adding…" : "Add Person"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
