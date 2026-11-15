import Link from "next/link";
import styles from "./Assignments.module.css";
import RoleTools from "./RoleTools";
import StudentSprintChecks from "../../components/staff/StudentSprintChecks";
import { courseTodayISO } from "../../lib/dateFormat";
import {
  getViewer, loadSprints, loadMps, loadCompletedSprintIds, courseDayOf, daysBetween, longDay, shortDay,
  formatClock, daysLeftLabel,
} from "../../lib/courseData";

export const metadata = { title: "Assignments" };

// Per-viewer (signed-in students see their own status), so never prerendered.
export const dynamic = "force-dynamic";

const external = { target: "_blank", rel: "noopener noreferrer" };

function sprintStatus(sprint, today, completed) {
  if (completed.has(sprint.id)) return { label: "Complete", tone: "done" };
  if (sprint.start_date > today) return { label: "Not started", tone: "muted" };
  if (sprint.end_date >= today) return { label: "In progress", tone: "open" };
  return { label: "Not marked complete", tone: "missing" };
}

export default async function AssignmentsPage() {
  const now = new Date();
  const today = courseTodayISO(now);
  const viewer = await getViewer();
  const isStudent = viewer?.role === "student";
  const [sprints, mps, completed] = await Promise.all([
    loadSprints(viewer, now),
    loadMps(now),
    isStudent ? loadCompletedSprintIds(viewer.netID) : Promise.resolve(new Set()),
  ]);
  const newestFirst = [...sprints].reverse();

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Assignments</h1>
        <p>MPs earn points and are done on PrairieLearn. Sprints are checked off by your PM at your weekly meeting, and every sprint is required.</p>
      </header>

      {isStudent && (
        <section className={styles.checks} id="checks" data-tour="student-checks">
          <StudentSprintChecks />
        </section>
      )}

      <div className={styles.columns}>
        <section id="mps" aria-labelledby="mps-heading" className={styles.section}>
          <h2 id="mps-heading">MPs</h2>
          {mps.length ? (
            <ul className={styles.list}>
              {[...mps].reverse().map((mp) => {
                const day = courseDayOf(mp.due_at);
                const open = new Date(mp.due_at) >= now;
                return (
                  <li key={mp.id}>
                    <div className={styles.main}>
                      <h3>MP {mp.name}</h3>
                      <p className={styles.meta}>Due {longDay(day)} at {formatClock(mp.due_at)}</p>
                    </div>
                    <div className={styles.side}>
                      <span className={styles.status} data-tone={open ? "open" : "muted"}>
                        {open ? daysLeftLabel(daysBetween(today, day)) : "Closed"}
                      </span>
                      {mp.prairielearn_url && <a href={mp.prairielearn_url} {...external}>Open on PrairieLearn</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>No MPs have been released yet.</p>
          )}
        </section>

        <section aria-labelledby="sprints-heading" className={styles.section}>
          <h2 id="sprints-heading">Sprints</h2>
          {!viewer && (
            <p className={styles.hint}><Link href="/signin">Sign in</Link> to see which sprints your PM has marked complete.</p>
          )}
          {newestFirst.length ? (
            <ul className={styles.list}>
              {newestFirst.map((sprint) => {
                const status = isStudent ? sprintStatus(sprint, today, completed) : null;
                const current = sprint.start_date <= today && today <= sprint.end_date;
                return (
                  <li key={sprint.id} id={`sprint-${sprint.number}`}>
                    <div className={styles.main}>
                      <h3>
                        Sprint {sprint.number}
                        <span>{shortDay(sprint.start_date)} to {shortDay(sprint.end_date)}</span>
                      </h3>
                      {sprint.goal && <p className={styles.goal}>{sprint.goal}</p>}
                    </div>
                    <div className={styles.side}>
                      {status ? (
                        <span className={styles.status} data-tone={status.tone}>{status.label}</span>
                      ) : current ? (
                        <span className={styles.status} data-tone="open">{daysLeftLabel(daysBetween(today, sprint.end_date)) || "Current"}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>No sprints have started yet.</p>
          )}
        </section>
      </div>

      {viewer && <RoleTools role={viewer.role} />}
    </main>
  );
}
