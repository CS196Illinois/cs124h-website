import styles from "../../dashboard.module.css";
import guide from "./Guide.module.css";

export const metadata = { title: "PM Guide" };

export default function PMGuidePage() {
  return (
    <main className={`${styles.container} ${guide.page}`}>
      <div className={guide.content}>
        <header className={guide.header}>
          <h1>Project Manager Guide</h1>
          <p>Your weekly checklist and quick reference.</p>
        </header>

        <div className={guide.panel}>
          <p className={guide.note}>
            <strong>Your scope:</strong> Manage your assigned group. Ask a Course Lead to fix missing students, group assignments, or permissions; don’t create duplicate accounts.
          </p>

          <section className={guide.section}>
            <h2>Each week</h2>
            <ol>
              <li><strong>Prepare:</strong> Confirm your roster in My Students, review Action Items, and select the current sprint’s check questions.</li>
              <li><strong>Meet:</strong> Open your group’s understanding check, review submissions, then close it.</li>
              <li><strong>Take attendance:</strong> Check the event’s audience, open check-in, and display the current code or QR code. Review attendees and close check-in afterward.</li>
              <li><strong>Follow up:</strong> Grade completed work, leave feedback, and assign next steps with an owner and due date.</li>
            </ol>
          </section>

          <section className={guide.section}>
            <h2>Quick reference</h2>
            <dl className={guide.reference}>
              <div>
                <dt>Action Items & grades</dt>
                <dd>Enable Gradable and set a maximum when assigning scored work. Only the assigner can grade completed items; scores range from 0 to the maximum. Reopening clears the grade. Edit instead of deleting to preserve history.</dd>
              </div>
              <div>
                <dt>Sprints & checks</dt>
                <dd>Future sprints stay hidden until their start date. Saved check questions are required; you can add questions, but a Course Lead must change existing ones. Completion totals cover your group only. Students can answer only while their group’s check is open.</dd>
              </div>
              <div>
                <dt>Attendance</dt>
                <dd>Students need an open event, the correct audience, and the current code. Add a missed attendee only after confirming attendance; remove accidental check-ins. Keep codes within the intended audience.</dd>
              </div>
            </dl>
          </section>

          <section className={guide.section}>
            <h2>Something wrong?</h2>
            <p>Check the alert and the record’s recipient, group, dates, or completion status. Refresh and retry once. If it still fails, send a Course Lead the page, affected record or student, time, and exact error or support code.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
