"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./OnboardingTour.module.css";
import { ROLE_NAMES } from "../../lib/siteConfig";

const ROLE_LABELS = ROLE_NAMES;

// Each step opens `href` (a path, no #hash) and highlights `target`
// (an element's data-tour attribute) when it's on the page.
const TOUR_STEPS = {
  course_lead: [
    { title: "Everything is on the main site", copy: "Your tools are in the second row of the top bar. Events, sprints, and grades are managed right where students read them.", href: "/", target: "role-tools" },
    { title: "People", copy: "Add people, set their roles and groups, and import rosters. A person’s role decides what they can see and do.", href: "/people", target: "tool-people" },
    { title: "Plan sprints", copy: "On Assignments, create each sprint with its goal, dates, and understanding check questions. Students don’t see a sprint until its start date.", href: "/assignments", target: "sprint-new" },
    { title: "Add events", copy: "On the Schedule, click Add event or click a day. Choose a category and who it’s for, and repeat it weekly if you like.", href: "/schedule", target: "schedule-add-event" },
    { title: "Run check-in", copy: "Under Manage events, open check-in, show the code, and see who attended. You can manage every event, whoever created it.", href: "/schedule", target: "manage-events" },
    { title: "Gradebook", copy: "Understanding check scores by group or by sprint, with CSV export, are on Assignments.", href: "/assignments", target: "gradebook-view" },
  ],
  head_pm: [
    { title: "Everything is on the main site", copy: "Your tools are in the second row of the top bar. Events, sprints, and grades are managed right where students read them.", href: "/", target: "role-tools" },
    { title: "People", copy: "Keep PM and student group assignments correct before each week starts.", href: "/people", target: "tool-people" },
    { title: "Sprints", copy: "On Assignments, review sprint goals and check questions, and grade any group’s understanding checks.", href: "/assignments", target: "sprint-new" },
    { title: "Events and check-in", copy: "Add events from the Schedule, then open check-in and see who attended under Manage events.", href: "/schedule", target: "manage-events" },
    { title: "Gradebook", copy: "Compare groups and open any student’s grade history on Assignments.", href: "/assignments", target: "gradebook-view" },
  ],
  lead_web_dev: [
    { title: "Support tickets", copy: "Read and resolve problems people report from the Support page.", href: "/support/tickets", target: "tool-support-tickets" },
    { title: "Events", copy: "You can see every course event and its attendance under Manage events.", href: "/schedule", target: "manage-events" },
  ],
  pm: [
    { title: "Everything is on the main site", copy: "Your tools are in the second row of the top bar. You don’t need to change anything as you go.", href: "/", target: "role-tools" },
    { title: "Your group", copy: "Check that your group’s names and NetIDs are right. Ask a Course Lead to fix anything missing.", href: "/my-group", target: "tool-my-group" },
    { title: "Track sprint progress", copy: "Mark each student’s sprint as Done here, and use Export CSV to download the list.", href: "/my-group", target: "students-export" },
    { title: "Run the understanding check", copy: "On Assignments, click Open Understanding Check when your meeting starts and close it when students finish. Grade each submission below it.", href: "/assignments", target: "sprint-open-check" },
    { title: "Add your group’s meetings", copy: "On the Schedule, click Add event. Group meetings default to your group, and you can repeat them every week.", href: "/schedule", target: "schedule-add-event" },
    { title: "Take attendance", copy: "Under Manage events, open check-in and show the code or its QR code.", href: "/schedule", target: "manage-events" },
    { title: "Gradebook", copy: "Your group’s check scores and feedback over time are on Assignments.", href: "/assignments", target: "gradebook-view" },
    { title: "PM guide", copy: "The PM guide on Resources walks through each week step by step. Come back to it anytime.", href: "/resources", target: "pm-guide" },
  ],
  student: [
    { title: "Welcome to CS 124H", copy: "The home page shows the current sprint and MP and what’s coming up. Your tools are in the second row of the top bar.", href: "/", target: "role-tools" },
    { title: "Understanding checks", copy: "When your PM opens your group’s check, your questions appear on Assignments. Answer every question and submit once. Your grade and feedback show up there too.", href: "/assignments", target: "student-checks" },
    { title: "Check in", copy: "During an event, enter the code your PM shows or scan the QR code.", href: "/checkin", target: "tool-check-in" },
    { title: "Need help?", copy: "Read the message on screen and try again. Still stuck? Use Support at the bottom of any page.", href: "/", target: "role-tools" },
  ],
};

export default function OnboardingTour() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.user?.role;
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [spotlight, setSpotlight] = useState(null);
  const steps = useMemo(() => TOUR_STEPS[role] || [], [role]);
  const storageKey = role && session?.user?.netID && session?.user?.onboardingSession
    ? `cs124h-onboarding:${session.user.netID}:${role}:${session.user.onboardingSession}`
    : null;

  useEffect(() => {
    if (status !== "authenticated" || !storageKey) return;
    // The auth callback determines first-login status from the roster's
    // Supabase `sub` field before it claims the row. Existing users should
    // never be interrupted by a new-user tour, even on a new browser.
    if (session?.user?.isNewUser !== true) {
      setDismissed(true);
      setReady(true);
      return;
    }
    setDismissed(window.localStorage.getItem(storageKey) === "complete");
    setReady(true);
  }, [status, storageKey]);

  const current = steps[step] || null;
  const [title, copy, tupleTarget, tupleHref] = current
    ? (Array.isArray(current) ? current : [current.title, current.copy, current.target, current.href])
    : ["", "", null, null];
  const target = tupleTarget ? `[data-tour="${tupleTarget}"]` : null;
  const href = tupleHref || null;
  const last = step === steps.length - 1;
  const finish = () => { if (storageKey) window.localStorage.setItem(storageKey, "complete"); setDismissed(true); };

  useEffect(() => {
    if (!ready || dismissed || !href || pathname === href) return;
    setSpotlight(null);
    router.push(href);
  }, [dismissed, href, pathname, ready, router]);

  useEffect(() => {
    if (!ready || dismissed || !target || (href && pathname !== href)) return undefined;
    let timer;
    const locate = () => {
      const element = document.querySelector(target);
      if (!element) { setSpotlight(null); return; }
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      const rect = element.getBoundingClientRect();
      setSpotlight({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
    };
    timer = window.setTimeout(locate, 180);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", locate); window.removeEventListener("scroll", locate, true); };
  }, [dismissed, target, href, pathname, ready]);

  if (!ready || dismissed || !steps.length || pathname === "/signin" || pathname === "/unauthorized") return null;

  return (
    <div className={`${styles.backdrop} ${spotlight ? styles.hasSpotlight : ""}`} role="presentation">
      {spotlight && <div className={styles.spotlight} style={spotlight} aria-hidden="true" />}
      <section className={styles.card} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className={styles.progress}><span>Getting started as {ROLE_LABELS[role]}</span><span>{step + 1}/{steps.length}</span></div>
        <div className={styles.progressBar}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <h2 id="onboarding-title">{title}</h2>
        <p>{copy}</p>
        <div className={styles.actions}>
          <button className={styles.skip} onClick={finish}>Skip tour</button>
          {step > 0 && <button className={styles.secondary} onClick={() => setStep(step - 1)}>Back</button>}
          <button className={styles.primary} onClick={() => last ? finish() : setStep(step + 1)}>{last ? "Finish" : "Next"}</button>
        </div>
      </section>
    </div>
  );
}
