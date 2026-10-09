"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./OnboardingTour.module.css";

const ROLE_LABELS = {
  course_lead: "Course Lead", head_pm: "Head PM", lead_web_dev: "Lead Web Dev",
  pm: "Project Manager", web_dev: "Web Developer", student: "Student",
};

const TOUR_STEPS = {
  course_lead: [
    { title: "Your course command center", copy: "This tour shows the pages you use to run the course: people, sprints, events, and grades.", href: "/user/course_lead", target: "nav-dashboard" },
    { title: "People", copy: "Add people, set their roles and groups, and import rosters. A person’s role decides what they can see.", href: "/user/course_lead/people", target: "nav-people" },
    { title: "Plan sprints", copy: "Create each sprint with its goal, dates, and understanding check questions. Students don’t see a sprint until its start date.", href: "/user/course_lead/sprints", target: "sprint-new" },
    { title: "Events and attendance", copy: "Create events for everyone or for chosen roles, groups, or people, then open check-in to take attendance.", href: "/user/course_lead/events", target: "event-new" },
    { title: "Gradebook", copy: "See understanding check scores by group or by sprint, and export them as a CSV.", href: "/user/course_lead/gradebook", target: "nav-gradebook" },
  ],
  head_pm: [
    { title: "Your PM leadership workspace", copy: "This tour shows the pages you use to support PMs and their groups.", href: "/user/head_pm", target: "nav-dashboard" },
    { title: "People", copy: "Keep PM and student group assignments correct before each week starts.", href: "/user/head_pm/people", target: "nav-people" },
    { title: "Sprints", copy: "Review sprint goals and check questions. You can grade any group’s understanding checks here.", href: "/user/head_pm/sprints", target: "nav-sprints" },
    { title: "Events and attendance", copy: "Create events for the right audience, open check-in, and review who attended.", href: "/user/head_pm/events", target: "event-new" },
    { title: "Gradebook", copy: "Compare groups and open any student’s grade history.", href: "/user/head_pm/gradebook", target: "nav-gradebook" },
  ],
  lead_web_dev: [
    { title: "Your web team workspace", copy: "This tour shows the pages you use to manage the web team and support the site.", href: "/user/lead_web_dev", target: "nav-dashboard" },
    { title: "Web devs", copy: "Add web developers and set their roles and groups.", href: "/user/lead_web_dev/people", target: "nav-web-devs" },
    { title: "Role requests", copy: "Approve or deny web developers’ requests to preview other roles’ dashboards.", href: "/user/lead_web_dev/role_requests", target: "nav-role-requests" },
    { title: "Support tickets", copy: "Read and resolve problems people report from the Support page.", href: "/user/lead_web_dev/support", target: "nav-support-tickets" },
    { title: "Sandbox mode", copy: "Sandbox keeps your changes private to you, so you can test without touching real data.", href: "/user/lead_web_dev", target: "nav-dashboard" },
  ],
  pm: [
    { title: "Your PM workspace", copy: "This tour shows the pages you use each week. You don’t need to change anything as you go.", href: "/user/pm", target: "nav-dashboard" },
    { title: "Your students", copy: "Check that your group’s names and NetIDs are right. Ask a Course Lead to fix anything missing.", href: "/user/pm/students", target: "nav-my-students" },
    { title: "Track sprint progress", copy: "Mark each student’s sprint as Done here, and use Export CSV to download the list.", href: "/user/pm/students", target: "students-export" },
    { title: "Sprints", copy: "Each sprint has a goal and understanding check questions. Use Edit Questions to add your own.", href: "/user/pm/sprints", target: "nav-sprints" },
    { title: "Run the understanding check", copy: "Click Open Understanding Check when your meeting starts and close it when students finish. Grade each submission from the list below it.", href: "/user/pm/sprints", target: "sprint-open-check" },
    { title: "Take attendance", copy: "Use + New Event to set the time and audience, then open check-in and show the code.", href: "/user/pm/events", target: "event-new" },
    { title: "Gradebook", copy: "See your group’s check scores and feedback over time.", href: "/user/pm/gradebook", target: "gradebook-view" },
    { title: "PM Guide", copy: "The PM Guide walks through each week step by step. Come back to it anytime.", href: "/user/pm/guide", target: "nav-pm-guide" },
  ],
  web_dev: [
    { title: "Your web developer workspace", copy: "You work with a group like a PM, and help build the site.", href: "/user/web_dev", target: "nav-dashboard" },
    { title: "Sandbox mode", copy: "Sandbox keeps your changes private to you, so you can try things without touching real data.", href: "/user/web_dev", target: "nav-dashboard" },
    { title: "Your group", copy: "My Students, Sprints, Events, and Gradebook work the same way they do for PMs.", href: "/user/web_dev/students", target: "nav-my-students" },
    { title: "PM Guide", copy: "The PM Guide walks through each week step by step.", href: "/user/web_dev/guide", target: "nav-pm-guide" },
  ],
  student: [
    { title: "Welcome to CS 124H", copy: "This tour shows where to find your sprint checks and attendance.", href: "/user/student", target: "nav-dashboard" },
    { title: "Sprint checks", copy: "When your PM opens your group’s understanding check, your questions appear here. Answer every question and submit once. Your grade and feedback show up here too.", href: "/user/student/sprints", target: "nav-sprints" },
    { title: "Attendance", copy: "During an event, enter the code your PM shows or scan the QR code.", href: "/user/student/attendance", target: "nav-attendance" },
    { title: "Need help?", copy: "Read the message on screen and try again. Still stuck? Use Support in the top bar.", href: "/user/student", target: "nav-dashboard" },
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
        <div className={styles.progress}><span>Getting started · {ROLE_LABELS[role]}</span><span>{step + 1}/{steps.length}</span></div>
        <div className={styles.progressBar}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <h2 id="onboarding-title">{title}</h2>
        <p>{copy}</p>
        <div className={styles.actions}>
          <button className={styles.skip} onClick={finish}>Skip tour</button>
          {step > 0 && <button className={styles.secondary} onClick={() => setStep(step - 1)}>Back</button>}
          <button className={styles.primary} onClick={() => last ? finish() : setStep(step + 1)}>{last ? "Go to my dashboard" : "Next"}</button>
        </div>
      </section>
    </div>
  );
}
