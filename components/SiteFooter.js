"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteFooter.module.css";
import { SITE } from "../lib/siteConfig";

export default function SiteFooter() {
  // Dashboards fill the viewport exactly, so they get no footer.
  if (usePathname()?.startsWith("/user")) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>{SITE.courseName}, {SITE.semester}. University of Illinois Urbana-Champaign.</p>
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
