import Link from "next/link";
import styles from "./Unauthorized.module.css";

export default async function UnauthorizedPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/user";
  const loginUrl = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.error}>401</div>
      <h1 className={styles.heading}>Unauthorized</h1>
      <p className={styles.description}>
        You don't have permission to view this page. Sign in with an account
        that has access or return to the homepage.
      </p>

      <div className={styles.buttonGroup}>
        <Link href={loginUrl} className={styles.signInButton}>
          Sign in
        </Link>
        <Link href="/" className={styles.homeButton}>
          Home
        </Link>
      </div>
    </div>
  );
}