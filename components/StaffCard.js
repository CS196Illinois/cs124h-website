import styles from "./StaffCard.module.css";

export default function StaffCard({ member, onClick }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") onClick?.(member);
  };

  return (
    <div
      className={styles.staffCardBox}
      onClick={() => onClick?.(member)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      key={member.id ?? member.name}
    >
      <div className={styles.staffImageBox}>
        <img src={member.image} alt={member.name} />
      </div>
      <p className={styles.staffCardText}>{member.name}</p>
    </div>
  );
}