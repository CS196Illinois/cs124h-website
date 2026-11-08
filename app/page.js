import Image from "next/image";
import Link from "next/link";
import {
  CalendarBlank, ClipboardText, BookOpen, Star, UsersThree, Lifebuoy,
  Globe, DiscordLogo, ArrowRight, Check,
} from "@phosphor-icons/react/dist/ssr";
import styles from "./home.module.css";
import { SITE } from "../lib/siteConfig";
import { getUpcoming } from "../lib/upcoming";

// Re-rendered at most once a minute so new sprints and events show up
// without a redeploy.
export const revalidate = 60;

const EXPLORE = [
  { href: "/schedule", icon: CalendarBlank, title: "Schedule", copy: "Every sprint, event, and deadline on one timeline." },
  { href: "/assignments", icon: ClipboardText, title: "Assignments", copy: "MPs and sprint work, with links to PrairieLearn." },
  { href: "/resources", icon: BookOpen, title: "Resources", copy: "Guides, lecture videos, and tools picked by PMs." },
  { href: "/hall_of_fame", icon: Star, title: "Hall of Fame", copy: "Standout projects from past semesters." },
  { href: "/course_staff", icon: UsersThree, title: "Course Staff", copy: "The course leads, PMs, and web team." },
  { href: "/support", icon: Lifebuoy, title: "Support", copy: "Something broken or confusing? Tell us." },
];

export default async function Home() {
  const upcoming = await getUpcoming();

  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{SITE.courseName} · {SITE.semester}</p>
            <h1 className={styles.motto}>
              You get what<br />you <span>put in.</span>
            </h1>
            <p className={styles.tagline}>
              {SITE.tagline} Build a real project from start to finish with a team, guided by a Project Manager.
            </p>
            <div className={styles.heroActions}>
              <Link href="/course_info#register" className="btn btnPrimary">
                How to join <ArrowRight size={16} weight="bold" />
              </Link>
              <a href={SITE.links.syllabus} target="_blank" rel="noopener noreferrer" className="btn">
                Syllabus
              </a>
            </div>
          </div>
          <Image src="/images/cs124h-logo.png" alt="" width={220} height={220} className={styles.heroLogo} priority />
        </div>
      </section>

      <div className="page">
        <section aria-labelledby="upcoming-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id="upcoming-heading">Coming up</h2>
            <Link href="/schedule" className={styles.sectionLink}>Full schedule <ArrowRight size={14} weight="bold" /></Link>
          </div>
          {upcoming.length ? (
            <ul className={styles.upcoming}>
              {upcoming.map((item) => (
                <li key={item.id} className={`card ${styles.upcomingCard}`} data-kind={item.kind}>
                  <span className={styles.tag}>{item.tag}</span>
                  <strong>{item.title}</strong>
                  {item.when && <span className={styles.when}>{item.when}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className={`card ${styles.empty}`}>
              <CalendarBlank size={22} />
              <p>Nothing scheduled right now. Sprints and events will show up here as the {SITE.semester} schedule is posted.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="where-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id="where-heading">Where to find things</h2>
          </div>
          <div className={styles.where}>
            <div className={`card ${styles.whereCard}`}>
              <div className={styles.whereIcon}><Globe size={22} weight="bold" /></div>
              <h3>This website</h3>
              <p className={styles.whereLead}>Official course information. If it&apos;s here, it&apos;s current.</p>
              <ul>
                <li><Check size={16} weight="bold" /> Schedule and deadlines</li>
                <li><Check size={16} weight="bold" /> Assignments, points, and grades</li>
                <li><Check size={16} weight="bold" /> Event check-in and attendance</li>
                <li><Check size={16} weight="bold" /> Resources and course policies</li>
              </ul>
            </div>
            <div className={`card ${styles.whereCard}`}>
              <div className={`${styles.whereIcon} ${styles.discordIcon}`}><DiscordLogo size={22} weight="fill" /></div>
              <h3>Discord</h3>
              <p className={styles.whereLead}>Quick updates and conversation.</p>
              <ul>
                <li><Check size={16} weight="bold" /> Reminders and announcements</li>
                <li><Check size={16} weight="bold" /> Quick questions for staff</li>
                <li><Check size={16} weight="bold" /> Chatting with your group</li>
              </ul>
              <a href={SITE.links.discord} target="_blank" rel="noopener noreferrer" className={`btn ${styles.discordButton}`}>
                Join the Discord
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="explore-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id="explore-heading">Explore</h2>
          </div>
          <ul className={styles.explore}>
            {EXPLORE.map(({ href, icon: Icon, title, copy }) => (
              <li key={href}>
                <Link href={href} className={`card ${styles.exploreCard}`}>
                  <Icon size={22} weight="duotone" className={styles.exploreIcon} />
                  <span>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
