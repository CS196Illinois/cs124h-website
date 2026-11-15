import Link from "next/link";
import { getSupabaseServer } from "../../lib/supabaseServer";
import { table } from "../../lib/tables";
import SignOutButton from "./SignOutButton";
import styles from "./Unauthorized.module.css";
import { SITE } from "../../lib/siteConfig";

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
  const callbackUrl = params?.callbackUrl || "/";
  const loginUrl = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  // Signed in successfully, but not (yet) on the Supabase roster. This is
  // the common case at the start of a semester: a student has enrolled but
  // the roster hasn't been updated for kickoff yet. Give them a clear,
  // reassuring explanation instead of a generic 401 that reads like an error
  // on their end.
  if (params?.reason === "not-enrolled") {
    const leads = await getCourseLeadContacts();

    return (
      <main className={`page ${styles.page}`}>
        <header className="pageHeading">
          <h1>You&apos;re not on the roster yet</h1>
        </header>
        <p>
          We signed you in, but couldn&apos;t find your NetID on the course roster. If you just enrolled, this is
          expected: the roster gets updated around kickoff. Sign out and back in afterward to pick up your access.
        </p>
        <p>
          Questions in the meantime? Reach out on our{" "}
          <a href={SITE.links.discord} target="_blank" rel="noopener noreferrer">Discord</a>
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
        <div className={styles.actions}>
          <SignOutButton />
          <Link href="/support" className="btn">Get help</Link>
          <Link href="/" className="btn">Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={`page ${styles.page}`}>
      <header className="pageHeading">
        <p className={styles.code}>Error 401</p>
        <h1>{params?.reason === "identity-missing" ? "We couldn't identify your Illinois account" : "Unauthorized"}</h1>
      </header>
      <p>You don&apos;t have permission to view this page. Sign in with an account that has access, or go back to the home page.</p>
      <div className={styles.actions}>
        <Link href={loginUrl} className="btn btnPrimary">Sign in</Link>
        <Link href="/support" className="btn">Get help</Link>
        <Link href="/" className="btn">Home</Link>
      </div>
    </main>
  );
}
