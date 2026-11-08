import Link from "next/link";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import styles from "./CourseInfo.module.css";
import { SITE } from "../../lib/siteConfig";
import { getSupabaseServer } from "../../lib/supabaseServer";
import { table } from "../../lib/tables";

export const metadata = { title: "Course Info" };

// The lead contact line comes from the roster, so refresh it periodically.
export const revalidate = 60;

async function getLeads() {
  try {
    const { data } = await getSupabaseServer().from(table("users")).select("net_id, name").eq("role", "LEAD");
    return data || [];
  } catch {
    return [];
  }
}

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "register", label: "How to register" },
  { id: "contact", label: "Contact" },
];

export default async function CourseInfoPage() {
  const leads = await getLeads();

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Course Info</h1>
        <p>What {SITE.shortName} is, how to sign up, and who to contact.</p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="On this page">
          <p>On this page</p>
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
        </nav>

        <div className={styles.content}>
          <section id="about" className={styles.section}>
            <h2>About</h2>
            <p>
              {SITE.courseName} is an add-on to CS 124 that mixes creativity and learning through hands-on,
              project-based work. You&apos;ll work in a group with support from a Project Manager (PM).
            </p>
            <p>
              You&apos;ll join a welcoming community and grow your network and skills through workshops, events,
              and other opportunities. By the end of the semester, you&apos;ll have taken a project from start to finish.
            </p>
            <blockquote className={styles.motto}>
              <strong>{SITE.motto}</strong>
              <span>The more effort you put into your project and your group, the more you&apos;ll get out of the course.</span>
            </blockquote>
            <div className={styles.video}>
              <iframe
                src={SITE.links.overviewVideo}
                title={`${SITE.courseName} overview`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>

          <section id="register" className={styles.section}>
            <h2>How to register</h2>
            <ol className={styles.steps}>
              <li>
                <h3>Enroll the right way</h3>
                <div className={styles.paths}>
                  <div className="card">
                    <h4>James Scholars (or taking it for honors credit)</h4>
                    <p>
                      Complete an Honors Credit Learning Agreement (HCLA) form stating that you are completing the
                      extra work for CS 124 honors credit.
                    </p>
                    <p className={styles.callout}><Warning size={16} weight="bold" /> Do not enroll in CS 199 124.</p>
                  </div>
                  <div className="card">
                    <h4>Everyone else</h4>
                    <p>
                      Enroll in <strong>CS 199 124</strong> (CRN <code>{SITE.crn}</code>) on Self-Service. It&apos;s zero
                      credit hours and graded S/U. You need to participate to earn the S.
                    </p>
                  </div>
                </div>
              </li>
              <li>
                <h3>Set up Google Apps @ Illinois</h3>
                <p>
                  Activate Google Apps for your NetID@illinois.edu account by following{" "}
                  <a href={SITE.links.googleAppsSetup} target="_blank" rel="noopener noreferrer">these instructions</a>.
                </p>
              </li>
              <li>
                <h3>Fill out the enrollment confirmation form</h3>
                <p>
                  <a href={SITE.links.enrollmentForm} target="_blank" rel="noopener noreferrer">Open the enrollment confirmation form</a>.
                </p>
                <p className={styles.callout}>
                  <Warning size={16} weight="bold" /> If you don&apos;t fill out this form, you&apos;ll receive an unsatisfactory grade.
                </p>
              </li>
              <li>
                <h3>Join the Discord</h3>
                <p>
                  Quick updates and conversations happen on{" "}
                  <a href={SITE.links.discord} target="_blank" rel="noopener noreferrer">Discord</a>. Official information
                  (deadlines, assignments, grades) always lives on this website.
                </p>
              </li>
            </ol>
          </section>

          <section id="contact" className={styles.section}>
            <h2>Contact</h2>
            {leads.length ? (
              <p>
                Questions about the course? Reach out to{" "}
                {leads.map((lead, i) => (
                  <span key={lead.net_id}>
                    {i > 0 && (i === leads.length - 1 ? " or " : ", ")}
                    {lead.name || lead.net_id} (<a href={`mailto:${lead.net_id}@illinois.edu`}>{lead.net_id}@illinois.edu</a>)
                  </span>
                ))}
                .
              </p>
            ) : (
              <p>Questions about the course? Reach out to the course leads listed on the <Link href="/course_staff">staff page</Link>.</p>
            )}
            <p>Found a bug on the website? <Link href="/support">Let us know</Link>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
