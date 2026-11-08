"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiscordLogo } from "@phosphor-icons/react";
import styles from "./SiteFooter.module.css";
import { SITE } from "../lib/siteConfig";

export default function SiteFooter() {
  // Dashboards fill the viewport exactly, so they get no footer.
  if (usePathname()?.startsWith("/user")) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.about}>
          <strong>{SITE.courseName}</strong>
          <span>{SITE.semester} · University of Illinois Urbana-Champaign</span>
          <span className={styles.motto}>“{SITE.motto.replace(/\.$/, "")}”</span>
        </div>
        <nav className={styles.columns} aria-label="Footer">
          <div>
            <h2>Course</h2>
            <Link href="/course_info">Course info</Link>
            <a href={SITE.links.syllabus} target="_blank" rel="noopener noreferrer">Syllabus</a>
            <Link href="/schedule">Schedule</Link>
          </div>
          <div>
            <h2>Get help</h2>
            <Link href="/support">Support</Link>
            <Link href="/course_staff">Course staff</Link>
            <a href={SITE.links.discord} target="_blank" rel="noopener noreferrer">
              <DiscordLogo size={15} weight="fill" /> Discord
            </a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
