import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";
import { SITE } from "../lib/siteConfig";
import { getHomeData } from "../lib/upcoming";
import { getViewer } from "../lib/courseData";

// Rendered per request: signed-in viewers also see their own events (their
// group's meetings, staff-only sessions).

const external = { target: "_blank", rel: "noopener noreferrer" };

function SprintCard({ sprint, lastSprint }) {
  if (!sprint) {
    return (
      <article className={`${styles.current} ${styles.idle}`} data-kind="sprint">
        <h3>Sprint</h3>
        <p>No sprint is running right now.{lastSprint && ` Sprint ${lastSprint.number} ended ${lastSprint.ended}.`}</p>
      </article>
    );
  }
  return (
    <article className={styles.current} data-kind="sprint">
      <div className={styles.currentHead}>
        <h3>Sprint {sprint.number}</h3>
        <span>{sprint.range}</span>
      </div>
      {sprint.goal && <p className={styles.goal}>{sprint.goal}</p>}
      <p className={styles.due}>
        {sprint.due}
        {sprint.left && <strong>{sprint.left}</strong>}
      </p>
    </article>
  );
}

function MpCard({ mp }) {
  if (!mp) {
    return (
      <article className={`${styles.current} ${styles.idle}`} data-kind="mp">
        <h3>MP</h3>
        <p>No MP is open right now.</p>
      </article>
    );
  }
  return (
    <article className={styles.current} data-kind="mp">
      <div className={styles.currentHead}>
        <h3>MP {mp.name}</h3>
      </div>
      <p className={styles.due}>
        {mp.due}
        {mp.left && <strong>{mp.left}</strong>}
      </p>
      {mp.url && <a className={styles.mpLink} href={mp.url} {...external}>Open on PrairieLearn</a>}
    </article>
  );
}

export default async function Home() {
  const viewer = await getViewer();
  const { sprint, lastSprint, mp, announcements } = await getHomeData(viewer);

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="home-title">
        <Image
          src="/images/home-background.jpg"
          alt=""
          fill
          sizes="100vw"
          className={styles.heroPhoto}
          priority
        />
        <div className={styles.heroInner}>
          <Image src="/images/cs124h-logo.png" alt="" width={84} height={84} className={styles.heroLogo} priority />
          <h1 id="home-title">CS124Honors@Illinois</h1>
          <p>{SITE.tagline}</p>
          <div className={styles.heroActions}>
            <a href={SITE.links.syllabus} {...external} className={styles.heroButton}>Syllabus</a>
            <Link href="/course_info#register" className={`${styles.heroButton} ${styles.heroButtonPrimary}`}>Register</Link>
          </div>
        </div>
      </section>

      <div className={`page ${styles.home}`}>
      <section aria-labelledby="now-heading">
        <h2 id="now-heading" className={styles.sectionTitle}>Right now</h2>
        <div className={styles.now}>
          <SprintCard sprint={sprint} lastSprint={lastSprint} />
          <MpCard mp={mp} />
        </div>
      </section>

      <section aria-labelledby="announcements-heading" className={styles.announcements}>
        <h2 id="announcements-heading" className={styles.sectionTitle}>Announcements</h2>
        <div className={styles.box}>
          {announcements.length ? (
            <ul>
              {announcements.map((item) => (
                <li key={item.id} data-kind={item.kind}>
                  <span className={styles.date} aria-hidden="true">
                    <span>{item.month}</span>
                    <strong>{item.day}</strong>
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemDetail}>{item.detail}</span>
                  </span>
                  <span className={styles.kind}>{item.kind === "deadline" ? "Deadline" : item.category}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No upcoming events or deadlines.</p>
          )}
          <p className={styles.note}>
            <Link href="/schedule">See the full schedule</Link>.{" "}
            {!viewer && "Sign in to also see your group's meetings. "}
            Reminders and quick questions go on <a href={SITE.links.discord} {...external}>Discord</a>.
          </p>
        </div>
      </section>
      </div>
    </main>
  );
}

