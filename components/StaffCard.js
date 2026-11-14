import PublicImage from "./PublicImage";
import styles from "./StaffCard.module.css";

/** A staff photo with name and (optionally) role; opens the detail dialog. */
export default function StaffCard({ member, onClick, showRole = false }) {
  return (
    <button type="button" className={styles.card} onClick={() => onClick?.(member)}>
      <span className={styles.photo}>
        {member.image ? (
          <PublicImage src={member.image} alt="" width={400} height={500} sizes="(max-width: 640px) 45vw, 200px" />
        ) : (
          <span className={styles.initial} aria-hidden="true">{member.name.slice(0, 1)}</span>
        )}
      </span>
      <span className={styles.name}>{member.name}</span>
      {showRole && <span className={styles.role}>{member.role}</span>}
    </button>
  );
}
