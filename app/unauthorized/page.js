import Link from "next/link";
import { getSupabaseServer } from "../../lib/supabaseServer";
import { table } from "../../lib/tables";
import SignOutButton from "./SignOutButton";
import styles from "./Unauthorized.module.css";

// Same mechanism the homepage footer uses for "Questions? Contact the course
// leads" - the real users table's LEAD role, not the course_staff bio page
// (which is semester-scoped marketing data, not the actual roster). This is
// the live, current set of people who can actually do something about a
// locked-out student.
async function getCourseLeadContacts() {
  try {
    const { data } = await getSupabaseServer()
      .from(table("users"))
      .select("net_id, name")
      .eq("role", "LEAD");
    return (data ?? []).map((u) => ({
      name: u.name || u.net_id,
      email: `${u.net_id}@illinois.edu`,
    }));
  } catch {
    return [];
  }
}

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
    const leads = await getCourseLeadContacts();

    return (
      <div className={styles.pageContainer}>
        <div className={styles.icon} aria-hidden="true">🎓</div>
        <h1 className={styles.heading}>You're not on the roster yet</h1>
        <p className={`${styles.description} ${styles.wideDescription}`}>
          We signed you in, but couldn&apos;t find your NetID on the course
          roster. If you just enrolled, this is expected: the roster gets
          updated around kickoff. Sessions don&apos;t recheck the roster on
          their own though, so once it&apos;s updated you&apos;ll need to sign
          out and sign back in for your access to take effect.
        </p>
        <p className={`${styles.description} ${styles.wideDescription}`}>
          Questions in the meantime? Reach out on our{" "}
          <a href="https://discord.gg/HBZ2thqde" target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          {leads.length > 0 && (
            <>
              , or contact{" "}
              {leads.map((lead, i) => (
                <span key={lead.email}>
                  {i > 0 && (i === leads.length - 1 ? " or " : ", ")}
                  {lead.name} (<a href={`mailto:${lead.email}`}>{lead.email}</a>)
                </span>
              ))}
            </>
          )}
          .
        </p>

        <div className={styles.buttonGroup}>
          <SignOutButton />
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
