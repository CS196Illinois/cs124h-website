import styles from "./Timeline.module.css";

export default function TimelineLoading() {
  return (
    <div className="pageContainer">
      <main className={styles.main}>
        <div className={styles.boxWrapper}>
          <div className="skeleton" style={{ flex: 3, borderRadius: "1rem", minHeight: "400px" }} />
          <div className="skeleton" style={{ flex: 1, borderRadius: "1rem", minHeight: "400px" }} />
        </div>
      </main>
    </div>
  );
}
