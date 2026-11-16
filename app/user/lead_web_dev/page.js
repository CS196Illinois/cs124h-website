"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "../dashboard.module.css";

const ROLE_DASHBOARDS = [
  { path: "/user/course_lead", label: "Course Lead" },
  { path: "/user/head_pm",     label: "Head PM" },
  { path: "/user/pm",          label: "PM" },
  { path: "/user/student",     label: "Student" },
];

export default function LeadWebDevDashboard() {
  const { data: session } = useSession();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lead Web Dev Dashboard</h1>
        <p>Welcome, {session?.user?.name || session?.user?.netID}</p>
      </div>

      <div className={`${styles.threeCol} ${styles.sectionGap}`}>
        {ROLE_DASHBOARDS.map(({ path, label }) => (
          <Link key={path} href={path} className={`${styles.panel} ${styles.roleShortcut}`}>
            <span>{label}</span>
            <span className={styles.roleShortcutAction}>View →</span>
          </Link>
        ))}
        <Link href="/user/lead_web_dev/support" className={`${styles.panel} ${styles.roleShortcut}`}>
          <span>Support tickets</span>
          <span className={styles.roleShortcutAction}>Open →</span>
        </Link>
      </div>
    </div>
  );
}
