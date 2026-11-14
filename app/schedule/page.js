import styles from "./Schedule.module.css";
import Timeline from "./Timeline";
import { SITE } from "../../lib/siteConfig";
import { getViewer } from "../../lib/courseData";
import { getScheduleData } from "../../lib/schedule";

export const metadata = { title: "Schedule" };

// Staff roles that can add events from the schedule (same as the events API).
const CAN_CREATE = ["course_lead", "lead_web_dev", "head_pm", "pm", "web_dev"];

function Week({ week }) {
  return (
    <section className={styles.week} aria-label={`${week.label}, ${week.range}`}>
      <h3>{week.label} <span>{week.range}</span></h3>
      <ul>
        {week.items.map((item) => (
          <li key={item.id} data-kind={item.kind} className={item.past ? styles.past : undefined}>
            <span className={styles.date} aria-hidden="true">
              <span>{item.month}</span>
              <strong>{item.date}</strong>
            </span>
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemDetail}>{item.detail}</span>
            </span>
            <span className={styles.kind}>{item.kind === "deadline" ? "Deadline" : item.category}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SchedulePage() {
  const viewer = await getViewer();
  const { timeline, upcomingWeeks, pastWeeks } = await getScheduleData(viewer);

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Schedule</h1>
        <p>
          Sprints, MPs, and events for the semester.{" "}
          {viewer ? "Events just for you, like your group's meetings, are included." : "Sign in to also see your group's meetings."}
        </p>
      </header>

      <Timeline
        data={timeline}
        viewer={viewer && CAN_CREATE.includes(viewer.role) ? { role: viewer.role, groupNumber: viewer.groupNumber, canCreate: true } : null}
      />

      <section aria-labelledby="list-heading" className={styles.list}>
        <div className={styles.listHead}>
          <h2 id="list-heading">Week by week</h2>
          <a href={SITE.links.calendar} target="_blank" rel="noopener noreferrer">Open the Google Calendar</a>
        </div>
        {upcomingWeeks.length ? (
          upcomingWeeks.map((week) => <Week key={week.start} week={week} />)
        ) : (
          <p className={styles.empty}>Nothing is scheduled from this week on.</p>
        )}
        {pastWeeks.length > 0 && (
          <details className={styles.earlier}>
            <summary>Earlier this semester</summary>
            {pastWeeks.map((week) => <Week key={week.start} week={week} />)}
          </details>
        )}
      </section>
    </main>
  );
}
