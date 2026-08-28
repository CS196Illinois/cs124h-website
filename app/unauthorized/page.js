import Link from "next/link";
import styles from "./Unauthorized.module.css";

export default async function UnauthorizedPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/user";
  const loginUrl = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  // Signed in successfully, but not (yet) on the Supabase roster. This is
  // the common case at the start of a semester: a student has enrolled but
  // the roster hasn't been updated for kickoff yet. Give them a clear,
  // reassuring explanation instead of a generic 401 that reads like an error
  // on their end.
  if (params?.reason === "not-enrolled") {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.icon} aria-hidden="true">🎓</div>
        <h1 className={styles.heading}>You're not on the roster yet</h1>
        <p className={styles.description}>
          We signed you in, but couldn&apos;t find your NetID on the course
          roster. If you just enrolled, this is expected: the roster gets
          updated around kickoff, and this page will unlock automatically
          once it is. No need to sign in again.
        </p>
        <p className={styles.description}>
          Questions in the meantime? Reach out on our{" "}
          <a href="https://discord.gg/HBZ2thqde" target="_blank" rel="noopener noreferrer">
            Discord
          </a>{" "}
          or contact one of the{" "}
          <Link href="/course_staff">course leads</Link>.
        </p>

        <div className={styles.buttonGroup}>
          <a
            href="https://discord.gg/HBZ2thqde"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.signInButton}
          >
            Join our Discord
          </a>
          <Link href="/" className={styles.homeButton}>
            Home
          </Link>
        </div>
      </div>
    );
  }

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
