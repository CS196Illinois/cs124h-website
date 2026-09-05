"use client";

import SprintsManager from "../../../../components/SprintsManager";
import UnderstandingCheckPanel from "../../../../components/UnderstandingCheckPanel";
import styles from "../../dashboard.module.css";

export default function PMSprints() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Sprints</h1>
        <p>Open the understanding check for your group during your weekly meeting</p>
      </div>
      <SprintsManager renderExtra={(sprint) => <UnderstandingCheckPanel sprint={sprint} scope="my-group" />} />
    </div>
  );
}
