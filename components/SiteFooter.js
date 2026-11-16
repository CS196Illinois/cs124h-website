import Link from "next/link";
import styles from "./SiteFooter.module.css";
import { SITE } from "../lib/siteConfig";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>{SITE.courseName}. University of Illinois Urbana-Champaign.</p>
        <nav aria-label="Footer">
          <a href={SITE.links.syllabus} target="_blank" rel="noopener noreferrer">Syllabus</a>
          <a href={SITE.links.discord} target="_blank" rel="noopener noreferrer">Discord</a>
          <Link href="/course_staff">Course staff</Link>
          <Link href="/support">Support</Link>
        </nav>
      </div>
    </footer>
  );
}
