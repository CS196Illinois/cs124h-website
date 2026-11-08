import Link from "next/link";
import styles from "./home.module.css";
import { SITE } from "../lib/siteConfig";
import { getUpcoming } from "../lib/upcoming";

// Re-rendered at most once a minute so new sprints and events show up
// without a redeploy.
export const revalidate = 60;

const external = { target: "_blank", rel: "noopener noreferrer" };

export default async function Home() {
  const upcoming = await getUpcoming();

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>{SITE.courseName}</h1>
        <p>{SITE.semester} · {SITE.tagline}</p>
      </header>

      <div className={styles.layout}>
        <div>
          <section aria-labelledby="upcoming-heading" className={styles.section}>
            <h2 id="upcoming-heading">Coming up</h2>
            {upcoming.length ? (
              <ul className={styles.upcoming}>
                {upcoming.map((item) => (
                  <li key={item.id} data-kind={item.kind}>
                    <span className={styles.tag}>{item.tag}</span>
                    <span className={styles.title}>{item.title}</span>
                    {item.when && <span className={styles.when}>{item.when}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                Nothing scheduled yet. Sprints and events will be listed here once the {SITE.semester} schedule is posted.
              </p>
            )}
            <p className={styles.more}><Link href="/schedule">Full schedule</Link></p>
          </section>

          <section aria-labelledby="new-heading" className={styles.section}>
            <h2 id="new-heading">New to the course?</h2>
            <p>
              {SITE.courseName} is an add-on to CS 124 where you build a project from start to finish with a
              small group and a Project Manager. See <Link href="/course_info#register">how to register</Link>; the
              enrollment confirmation form is required.
            </p>
            <p>
              This website is the official source for deadlines, assignments, and grades.{" "}
              <a href={SITE.links.discord} {...external}>Discord</a> is for announcements, quick questions, and
              talking with your group.
            </p>
          </section>
        </div>

        <aside aria-labelledby="links-heading" className={styles.aside}>
          <h2 id="links-heading">Course links</h2>
          <ul>
            <li><a href={SITE.links.syllabus} {...external}>Syllabus</a></li>
            <li><Link href="/course_info">Course info</Link></li>
            <li><a href={SITE.links.discord} {...external}>Discord</a></li>
            <li><a href={SITE.links.calendar} {...external}>Google Calendar</a></li>
            <li><Link href="/course_staff">Course staff</Link></li>
            <li><Link href="/support">Report a website problem</Link></li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
