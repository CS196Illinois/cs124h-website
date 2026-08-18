import { ROLES_BY_ID } from "../../../lib/roles";
import styles from "../dashboard.module.css";

export default function RoleBadge({ roleId }) {
  const def = ROLES_BY_ID[roleId];
  return (
    <span className={`${styles.badge} ${def ? styles[def.badgeClass] : ""}`}>
      {roleId}
    </span>
  );
}
