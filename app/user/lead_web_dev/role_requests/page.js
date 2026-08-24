"use client";

import { useState, useEffect, useCallback } from "react";
import { useUndo } from "../../../../components/UndoProvider";
import styles from "../../dashboard.module.css";

const ROLE_LABELS = {
  course_lead: "Course Lead",
  head_pm: "Head PM",
  pm: "PM",
  student: "Student",
};

const DURATION_PRESETS = [
  { label: "1 day",   days: 1 },
  { label: "3 days",  days: 3 },
  { label: "7 days",  days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "Permanent", days: null },
];

function expiryLabel(expires_at) {
  if (!expires_at) return "Permanent";
  const diff = new Date(expires_at) - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return "1 day left";
  if (days <= 7) return `${days} days left`;
  return new Date(expires_at).toLocaleDateString();
}

function expiryColor(expires_at) {
  if (!expires_at) return "rgba(249,249,249,0.45)";
  const days = (new Date(expires_at) - Date.now()) / (1000 * 60 * 60 * 24);
  if (days <= 1) return "#f87171";
  if (days <= 3) return "#ecb557";
  return "rgba(249,249,249,0.45)";
}

export default function LeadWebRoleRequests() {
  const { scheduleUndo } = useUndo();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveDays, setApproveDays] = useState(7);
  const [approveLoading, setApproveLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/role-view-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleDeny = async (id) => {
    setActionLoading(id);
    await fetch(`/api/role-view-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "denied" }),
    });
    await fetchRequests();
    setActionLoading(null);
  };

  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setApproveLoading(true);
    await fetch(`/api/role-view-requests/${approveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", duration_days: approveDays }),
    });
    setApproveTarget(null);
    setApproveDays(7);
    setApproveLoading(false);
    await fetchRequests();
  };

  const handleRevoke = (id, requester) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    scheduleUndo({
      message: `Revoked ${requester}'s ${ROLE_LABELS[req.requested_role] ?? req.requested_role} view access`,
      onExpire: () => fetch(`/api/role-view-requests/${id}`, { method: "DELETE" }),
      onCancel: () => setRequests((prev) => [...prev, req]),
    });
  };

  const displayed = requests.filter((r) => filter === "all" || r.status === filter);

  const counts = {
    pending:  requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    denied:   requests.filter((r) => r.status === "denied").length,
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Role View Requests</h1>
        <p>Approve or deny web dev requests to view role dashboards</p>
      </div>

      <div className={styles.statsGrid}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.skeletonBlock} style={{ height: "2rem", width: "50%", margin: "0 auto 0.5rem" }} />
                <div className={styles.skeletonBlock} style={{ height: "0.65rem", width: "65%", margin: "0 auto" }} />
              </div>
            ))
          : [
              { label: "Pending",  val: counts.pending },
              { label: "Approved", val: counts.approved },
              { label: "Denied",   val: counts.denied },
            ].map(({ label, val }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNumber}>{val}</div>
                <div className={styles.statLabel}>{label}</div>
              </div>
            ))
        }
      </div>

      <div className={styles.tabs}>
        {["pending", "approved", "denied", "all"].map((f) => (
          <button
            key={f}
            className={`${styles.tab} ${filter === f ? styles.activeTab : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && counts[f] > 0 && (
              <span style={{ background: "#ecb557", color: "#112a67", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.75rem", marginLeft: "0.4rem", fontWeight: 700 }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {loading ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}><tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[60, 50, 35, 40, 50, 80].map((w, j) => (
                    <td key={j}><div className={styles.skeletonBlock} style={{ height: "0.85rem", width: `${w}%` }} /></td>
                  ))}
                </tr>
              ))}
            </tbody></table>
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📭</span>
            No {filter === "all" ? "" : filter} requests
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((req) => (
                  <tr key={req.id}>
                    <td className={styles.cellMono}>{req.requester_net_id}</td>
                    <td>{ROLE_LABELS[req.requested_role] ?? req.requested_role}</td>
                    <td>
                      {req.status === "pending" && (
                        <span style={{ background: "rgba(236,181,87,0.15)", color: "#ecb557", borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.78rem", fontWeight: 600 }}>Pending</span>
                      )}
                      {req.status === "approved" && (
                        <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.78rem", fontWeight: 600 }}>Approved</span>
                      )}
                      {req.status === "denied" && (
                        <span style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.78rem", fontWeight: 600 }}>Denied</span>
                      )}
                    </td>
                    <td style={{ color: "rgba(249,249,249,0.5)", fontSize: "0.82rem" }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ color: expiryColor(req.expires_at), fontSize: "0.82rem" }}>
                      {req.status === "approved" ? expiryLabel(req.expires_at) : "—"}
                    </td>
                    <td>
                      <div className={styles.cellActions}>
                        {req.status === "pending" && (
                          <>
                            <button
                              className={styles.btnSmall}
                              style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                              onClick={() => { setApproveTarget(req); setApproveDays(7); }}
                              disabled={actionLoading === req.id}
                            >
                              Approve
                            </button>
                            <button
                              className={styles.btnDanger}
                              onClick={() => handleDeny(req.id)}
                              disabled={actionLoading === req.id}
                            >
                              {actionLoading === req.id ? "…" : "Deny"}
                            </button>
                          </>
                        )}
                        {req.status === "approved" && (
                          <button
                            className={styles.btnDanger}
                            onClick={() => handleRevoke(req.id, req.requester_net_id)}
                            disabled={actionLoading === req.id}
                          >
                            {actionLoading === req.id ? "…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve modal */}
      {approveTarget && (
        <div className={styles.overlay} onClick={() => setApproveTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Approve Role View Access</h2>
            <p style={{ color: "rgba(249,249,249,0.6)", fontFamily: "Inter", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
              Granting <strong style={{ color: "#f9f9f9" }}>{approveTarget.requester_net_id}</strong> access to view the{" "}
              <strong style={{ color: "#f9f9f9" }}>{ROLE_LABELS[approveTarget.requested_role]}</strong> dashboard.
            </p>
            <div className={styles.formGroup}>
              <label>Access Duration</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.35rem" }}>
                {DURATION_PRESETS.map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setApproveDays(days)}
                    style={{
                      padding: "0.3rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid",
                      fontSize: "0.82rem",
                      fontFamily: "Inter",
                      cursor: "pointer",
                      background: approveDays === days ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.05)",
                      borderColor: approveDays === days ? "rgba(74,222,128,0.45)" : "rgba(255,255,255,0.12)",
                      color: approveDays === days ? "#4ade80" : "rgba(249,249,249,0.65)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ color: "rgba(249,249,249,0.35)", fontFamily: "Inter", fontSize: "0.76rem", marginTop: "0.5rem" }}>
                {approveDays === null
                  ? "Access will not expire automatically."
                  : `Access expires ${new Date(Date.now() + approveDays * 24 * 60 * 60 * 1000).toLocaleDateString()}.`}
              </p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setApproveTarget(null)}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={handleApproveConfirm}
                disabled={approveLoading}
                style={{ background: "rgba(74,222,128,0.18)", borderColor: "rgba(74,222,128,0.35)", color: "#4ade80" }}
              >
                {approveLoading ? "Approving…" : "Approve Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
