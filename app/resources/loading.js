import styles from "./Resources.module.css";

export default function ResourcesLoading() {
  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Resources</h1>
        <p>Lecture videos, blog posts, and links collected by PMs and students.</p>
      </header>
      <section className={styles.section}>
        <h2>Lecture videos</h2>
        <div className={styles.videoGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "16/10", borderRadius: "8px" }} />
          ))}
        </div>
      </section>
    </main>
  );
}
