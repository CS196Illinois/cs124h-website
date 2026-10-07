"use client";

import styles from "../dashboard.module.css";
import EventsPanel from "./EventsPanel";

/** The Events page every staff role shares; EventsPanel scopes it per role. */
export default function EventsPage() {
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
