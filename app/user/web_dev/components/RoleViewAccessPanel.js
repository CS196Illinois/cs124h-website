"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../../dashboard.module.css";
import { PanelHeader } from "../../components/DashboardParts";

const REQUESTABLE_ROLES = [
  { id: "course_lead", label: "Course Lead", path: "/user/course_lead" },
  { id: "head_pm",     label: "Head PM",     path: "/user/head_pm" },
  { id: "pm",          label: "PM",          path: "/user/pm" },
  { id: "student",     label: "Student",     path: "/user/student" },
];
const ROLE_BY_ID = Object.fromEntries(REQUESTABLE_ROLES.map((r) => [r.id, r]));
const DAY_MS = 1000 * 60 * 60 * 24;

function expiryLabel(expiresAt) {
  if (!expiresAt) return "Permanent";
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / DAY_MS);
  if (days === 1) return "1 day left";
  if (days <= 7) return `${days} days left`;
  return `Expires ${new Date(expiresAt).toLocaleDateString()}`;
}

function expiryClass(expiresAt) {
  if (!expiresAt) return styles.expiryNormal;
  const days = (new Date(expiresAt) - Date.now()) / DAY_MS;
  if (days <= 1) return styles.expiryUrgent;
  if (days <= 3) return styles.expirySoon;
  return styles.expiryNormal;
}

const roleLabel = (id) => ROLE_BY_ID[id]?.label || id;

/** A web developer's approved, pending, and requestable dashboard previews. */
export default function RoleViewAccessPanel() {
  const { status } = useSession();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null);
  const [requestError, setRequestError] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/role-view-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchRequests();
  }, [status, fetchRequests]);

  const approved = requests.filter((r) => r.status === "approved");
  const pending = requests.filter((r) => r.status === "pending");
  const requestedRoleIds = new Set([...approved, ...pending].map((r) => r.requested_role));
  const availableToRequest = REQUESTABLE_ROLES.filter((r) => !requestedRoleIds.has(r.id));

  const handleRequest = async (roleId) => {
    setRequestError("");
    setRequesting(roleId);
    const res = await fetch("/api/role-view-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_role: roleId }),
    });
    const json = await res.json();
    if (!res.ok) setRequestError(json.error || "Failed to submit request.");
    else await fetchRequests();
    setRequesting(null);
  };

  return (
    <div className={styles.panel}>
      <PanelHeader title="Role View Access" />

      {loading ? (
        <div className={styles.listStack}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.skeletonBlock} ${styles.skeletonAccessRow}`} />
          ))}
        </div>
      ) : (
        <>
          {approved.length > 0 && (
            <div className={styles.accessSection}>
              <div className={styles.sectionLabel}>Approved</div>
              <div className={styles.accessList}>
                {approved.map((r) => (
                  <Link key={r.id} href={ROLE_BY_ID[r.requested_role]?.path || "#"} className={`${styles.accessRow} ${styles.accessApproved}`}>
                    <div>
                      <div className={styles.listPrimary}>{roleLabel(r.requested_role)}</div>
                      <div className={`${styles.accessExpiry} ${expiryClass(r.expires_at)}`}>{expiryLabel(r.expires_at)}</div>
                    </div>
                    <span className={styles.accessApprovedAction}>View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div className={styles.accessSection}>
              <div className={styles.sectionLabel}>Pending Approval</div>
              <div className={styles.accessList}>
                {pending.map((r) => (
                  <div key={r.id} className={`${styles.accessRow} ${styles.accessPending}`}>
                    <span className={styles.listPrimary}>{roleLabel(r.requested_role)}</span>
                    <span className={styles.accessPendingAction}>Pending…</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableToRequest.length > 0 && (
            <div>
              <div className={styles.sectionLabel}>Request Access</div>
              {requestError && <div className={styles.accessError}>{requestError}</div>}
              <div className={styles.accessList}>
                {availableToRequest.map((r) => (
                  <div key={r.id} className={`${styles.accessRow} ${styles.accessAvailable}`}>
                    <span className={styles.accessAvailableLabel}>{r.label}</span>
                    <button className={styles.accessButton} onClick={() => handleRequest(r.id)} disabled={requesting === r.id}>
                      {requesting === r.id ? "…" : "Request"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approved.length === 0 && pending.length === 0 && availableToRequest.length === 0 && (
            <div className={styles.emptyState} style={{ padding: "1rem 0" }}>All roles requested</div>
          )}
        </>
      )}
    </div>
  );
}
