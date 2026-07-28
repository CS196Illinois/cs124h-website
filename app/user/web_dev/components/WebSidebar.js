"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RoleSidebar from "../../components/RoleSidebar";
import styles from "../../components/UserSidebar.module.css";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/action_items", label: "Action Items" },
  { href: "/events",       label: "Events"       },
];

const ROLE_LABELS = {
  course_lead: "Course Lead",
  head_pm:     "Head PM",
  pm:          "PM",
  student:     "Student",
};
const ROLE_PATHS = {
  course_lead: "/user/course_lead",
  head_pm:     "/user/head_pm",
  pm:          "/user/pm",
  student:     "/user/student",
};

export default function WebSidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [approvedRoles, setApprovedRoles] = useState([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/role-view-requests")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setApprovedRoles(
        data.filter((r) => r.status === "approved" && (!r.expires_at || new Date(r.expires_at) > new Date()))
      ))
      .catch(() => {});
  }, [status]);

  return (
    <RoleSidebar links={links} base="/user/web_dev" roleTitle="Web Dev" ownRole="web_dev">
      {approvedRoles.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <div className={styles.roleTitle} style={{ marginBottom: "0.5rem" }}>Test As Role</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
            {approvedRoles.map((r) => {
              const path = ROLE_PATHS[r.requested_role];
              if (!path) return null;
              return (
                <Link
                  key={r.id}
                  href={path}
                  className={`${styles.link} ${pathname.startsWith(path) ? styles.active : ""}`}
                  style={{ fontSize: "0.85rem" }}
                >
                  {ROLE_LABELS[r.requested_role] || r.requested_role}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </RoleSidebar>
  );
}
