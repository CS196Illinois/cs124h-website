import styles from "./Resources.module.css";

function SectionSkeleton({ title, count }) {
  return (
    <div className={styles.resourceSection}>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.projectGrid}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: "220px", borderRadius: "12px" }} />
        ))}
      </div>
    </div>
  );
}

export default function ResourcesLoading() {
  return (
    <div className="pageContainer">
      <main className={styles.mainContent}>
        <SectionSkeleton title="Lecture Videos" count={4} />
        <SectionSkeleton title="Blog Posts" count={4} />
      </main>
    </div>
  );
}
