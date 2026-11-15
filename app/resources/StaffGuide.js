"use client";

import { useSession } from "next-auth/react";
import PMGuide from "../../components/staff/PMGuide";
import styles from "./Resources.module.css";

// Shown to the people who run groups; it isn't secret, just not useful to students.
const GUIDE_ROLES = ["pm", "head_pm", "course_lead"];

export default function StaffGuide() {
  const { data: session } = useSession();
  if (!GUIDE_ROLES.includes(session?.user?.role)) return null;
  return (
    <section id="pm-guide" className={styles.section} data-tour="pm-guide">
      <PMGuide />
    </section>
  );
}
