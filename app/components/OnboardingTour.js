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
    { title: "Your course command center", copy: "Follow the highlighted pages to manage people, sprints, events, and grades.", href: "/user/course_lead", target: "nav-dashboard" },
    { title: "People and permissions", copy: "People is the source of truth for roles, groups, names, and login access.", href: "/user/course_lead/people", target: "nav-people" },
    { title: "Plan sprints", copy: "Create goals and dates here. Future sprints stay hidden until their start date.", href: "/user/course_lead/sprints", target: "nav-sprints" },
    { title: "Run scoped events", copy: "Choose roles, groups, or people before opening check-in.", href: "/user/course_lead/events", target: "nav-events" },
    { title: "Review grades", copy: "Gradebook shows course and group progress and supports CSV export.", href: "/user/course_lead/gradebook", target: "nav-gradebook" },
  ],
  head_pm: [
    { title: "Your PM leadership workspace", copy: "Follow the highlighted pages to support groups and keep weekly work moving.", href: "/user/head_pm", target: "nav-dashboard" },
    { title: "Manage groups", copy: "Confirm PM roles and group assignments before the week begins.", href: "/user/head_pm/people", target: "nav-people" },
    { title: "Coordinate sprints", copy: "Review goals and future understanding checks; future sprints stay hidden until their start date.", href: "/user/head_pm/sprints", target: "nav-sprints" },
    { title: "Run events", copy: "Set the correct audience before opening check-in, then review attendance.", href: "/user/head_pm/events", target: "nav-events" },
    { title: "Review progress", copy: "Compare groups, inspect assignment history, and export a course snapshot.", href: "/user/head_pm/gradebook", target: "nav-gradebook" },
  ],
  lead_web_dev: [
    { title: "Your web team workspace", copy: "Follow the highlighted pages to manage access, preview safely, and support course operations.", href: "/user/lead_web_dev", target: "nav-dashboard" },
    { title: "Manage people", copy: "Use Web Devs for web roles and groups. Keep access aligned with the work someone needs to do.", href: "/user/lead_web_dev/people", target: "nav-web-devs" },
    { title: "Review role requests", copy: "Role Requests controls which dashboards Web Developers may preview.", href: "/user/lead_web_dev/role_requests", target: "nav-role-requests" },
    { title: "Use sandbox mode", copy: "Sandbox keeps event, sprint, and roster experiments private to you.", href: "/user/lead_web_dev", target: "nav-dashboard" },
    { title: "Support events", copy: "Check event audiences and check-in behavior when troubleshooting attendance.", href: "/user/lead_web_dev/events", target: "nav-events" },
  ],
  pm: [
    { title: "Your PM workspace", copy: "This tour will take you through the pages you use each week. Follow the highlighted link or control; you do not need to change any data.", href: "/user/pm", target: "nav-dashboard" },
    { title: "Check your roster", copy: "Open My Students to verify your group, student names, and NetIDs.", href: "/user/pm/students", target: "nav-my-students" },
    { title: "Export your roster", copy: "Use Export CSV when you need a copy of your current student list and progress.", href: "/user/pm/students", target: "students-export" },
    { title: "Run a sprint check", copy: "Sprints contains the weekly goal and questions. Future sprints stay hidden until their start date.", href: "/user/pm/sprints", target: "nav-sprints" },
    { title: "Open the group check", copy: "Use Open Check for your group during the meeting and close it when students finish.", href: "/user/pm/sprints", target: "sprint-open-check" },
    { title: "Create an event", copy: "Events handles meetings and attendance. Choose everyone, roles, groups, or selected people before opening check-in.", href: "/user/pm/events", target: "nav-events" },
    { title: "Set up an event", copy: "Use New Event to set the time and audience. Only people in that audience can see and check in.", href: "/user/pm/events", target: "event-new" },
    { title: "Review grades", copy: "Gradebook shows graded understanding checks for your group. Scores must be within the check’s maximum; zero is valid.", href: "/user/pm/gradebook", target: "nav-gradebook" },
    { title: "Open student progress", copy: "Use the gradebook view to inspect checks, feedback, and student history.", href: "/user/pm/gradebook", target: "gradebook-view" },
    { title: "Keep the guide handy", copy: "The PM Guide is the reference for permissions, weekly steps, attendance, grading, and error recovery.", href: "/user/pm/guide", target: "nav-pm-guide" },
  ],
  web_dev: [
    { title: "Your web developer workspace", copy: "Follow the highlighted pages to work safely with course data and web tools.", href: "/user/web_dev", target: "nav-dashboard" },
    { title: "Preview safely", copy: "Use sandbox mode before changing events, sprints, or people.", href: "/user/web_dev", target: "nav-dashboard" },
    { title: "Respect visibility", copy: "Future sprints and scoped events are visible only when their dates and audiences allow them.", href: "/user/web_dev/events", target: "nav-events" },
  ],
  student: [
    { title: "Welcome to CS 124H", copy: "Follow the highlighted pages to find your sprint checks, events, and attendance.", href: "/user/student", target: "nav-dashboard" },
    { title: "Complete sprint checks", copy: "Your questions appear when your PM opens your group’s sprint check. Answer every question and submit once.", href: "/user/student/sprints", target: "nav-sprints" },
    { title: "Join events", copy: "Use Attendance to enter the code or scan the QR code while check-in is open.", href: "/user/student/attendance", target: "nav-attendance" },
    { title: "Get help", copy: "Read the exact alert, retry after correcting the requested field, and contact staff if it continues.", href: "/user/student", target: "nav-dashboard" },
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
