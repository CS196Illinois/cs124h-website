"use client";

import SprintsManager from "../../../../components/SprintsManager";
import styles from "../../dashboard.module.css";

export default function CourseLeadSprints() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Sprints</h1>
        <p>Manage sprint goals and track student completion</p>
      </div>
      <SprintsManager canManage />
    </div>
  );
}
