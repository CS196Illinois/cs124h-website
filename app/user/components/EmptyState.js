import styles from "../dashboard.module.css";

export default function EmptyState({ icon, message }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>{icon}</span>
      {message}
    </div>
  );
}
