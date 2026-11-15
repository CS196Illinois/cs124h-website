import styles from "./staff/dashboard.module.css";

export default function GroupFilter({ users, value, onChange }) {
  const groups = [...new Set(users.filter((u) => u.group_number != null).map((u) => Number(u.group_number)))]
    .filter(Number.isFinite).sort((a, b) => a - b);
  return (
    <select
      aria-label="Filter by group"
      className={`${styles.chip} ${styles.groupFilter} ${value !== "ALL" ? styles.activeChip : ""}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="ALL">All groups</option>
      <option value="UNASSIGNED">Unassigned</option>
      {groups.map((group) => <option key={group} value={String(group)}>Group {group}</option>)}
    </select>
  );
}
