"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RoleSidebar from "../../components/RoleSidebar";
import styles from "../../components/UserSidebar.module.css";

const links = [
  { href: "/",              label: "Dashboard"     },
  { href: "/support",       label: "Support Tickets" },
  { href: "/events",        label: "Events"        },
  { href: "/user/checkin",  label: "Attendance", absolute: true },
];

const TEST_ROLES = [
  { path: "/user/course_lead", label: "Course Lead" },
  { path: "/user/head_pm",     label: "Head PM"     },
  { path: "/user/pm",          label: "PM"          },
  { path: "/user/student",     label: "Student"     },
];

export default function LeadWebSidebar() {
  const pathname = usePathname();
  return (
    <RoleSidebar links={links} base={null} roleTitle="Lead Web Dev" ownRole={null}>
      <div style={{ marginTop: "1.5rem" }}>
        <div className={styles.roleTitle} style={{ marginBottom: "0.5rem" }}>Test As Role</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
          {TEST_ROLES.map(({ path, label }) => (
            <Link
              key={path}
              href={path}
              className={`${styles.link} ${pathname.startsWith(path) ? styles.active : ""}`}
              style={{ fontSize: "0.85rem" }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </RoleSidebar>
  );
}
