"use client";

import styles from "../../dashboard.module.css";
import EventsPanel from "../../components/EventsPanel";

export default function HeadPMEvents() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Events</h1>
      </div>
      <div className={styles.panel}>
        <EventsPanel />
      </div>
    </div>
  );
}
