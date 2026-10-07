"use client";

import styles from "../dashboard.module.css";
import SandboxPanel from "../components/SandboxPanel";
import RoleViewAccessPanel from "./components/RoleViewAccessPanel";
import { GroupDashboard } from "../components/DashboardParts";

export default function WebDevDashboard() {
  return (
    <GroupDashboard
      title="Web Dev Dashboard"
      rosterHref="/user/web_dev/students"
      aside={(
        <div className={styles.sideStack}>
          <RoleViewAccessPanel />
          <SandboxPanel />
        </div>
      )}
    />
  );
}
