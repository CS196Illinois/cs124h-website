import styles from "../../dashboard.module.css";
import guide from "./Guide.module.css";

export const metadata = { title: "PM Guide" };

function Screenshot({ src, alt, width, height }) {
  return (
    <figure className={guide.figure}>
      <img src={src} alt={alt} width={width} height={height} loading="lazy" />
    </figure>
  );
}

export default function PMGuidePage() {
  return (
    <main className={`${styles.container} ${guide.page}`}>
      <div className={guide.content}>
        <header className={guide.header}>
          <h1>Project Manager Guide</h1>
          <p>What to do each week, and where to do it.</p>
        </header>

        <div className={guide.panel}>
          <p className={guide.note}>
            <strong>Your scope:</strong> You manage your assigned group. Ask a Course Lead to fix missing students, group assignments, or permissions; don’t create duplicate accounts.
          </p>

          <section className={guide.section}>
            <h2>1. Before the meeting</h2>
            <p>Open <strong>My Students</strong> and check that your roster is right. On <strong>Sprints</strong>, pick the current sprint and use <strong>Edit Questions</strong> to add questions for your group. The course’s shared questions are always included.</p>
          </section>

          <section className={guide.section}>
            <h2>2. Run the understanding check</h2>
            <p>On <strong>Sprints</strong>, click <strong>Open Understanding Check</strong> when the meeting starts. Students answer on their own Sprints page. Click <strong>Close Understanding Check</strong> when everyone is done.</p>
            <p>Each submission shows <strong>Ready to grade</strong>. Click <strong>Grade</strong> to enter a score (0 up to the maximum) and optional feedback. Students see both on their Sprints page.</p>
            <Screenshot src="/guide/pm-understanding-check.png" alt="Understanding Check panel with the check open, two submissions, and Grade buttons" width={996} height={474} />
          </section>

          <section className={guide.section}>
            <h2>3. Take attendance</h2>
            <p>On <strong>Events</strong>, click <strong>+ New Event</strong>, set the time, and choose who it’s for. Only that audience can check in. Click <strong>Open Check-in</strong> and show the code; use the magnifier to enlarge it or show a QR code. The code changes every 30 seconds.</p>
            <p>Use <strong>Attendees</strong> to see who checked in, add someone who was there but couldn’t check in, or remove a mistake. Click <strong>Close Check-in</strong> afterward.</p>
            <Screenshot src="/guide/pm-events.png" alt="Events page with an open check-in and its rotating code" width={1060} height={495} />
          </section>

          <section className={guide.section}>
            <h2>4. Track progress</h2>
            <p>In <strong>My Students</strong>, choose the sprint and click a student’s <strong>Pending</strong> button to mark their sprint <strong>Done</strong>. <strong>Export CSV</strong> downloads the list. <strong>Gradebook</strong> shows each student’s check scores and feedback over time.</p>
            <Screenshot src="/guide/pm-students.png" alt="My Students roster with one student marked Done for Sprint 3" width={996} height={348} />
          </section>

          <section className={guide.section}>
            <h2>Good to know</h2>
            <ul>
              <li>Future sprints stay hidden until their start date.</li>
              <li>Students can only answer while your group’s check is open.</li>
              <li>Everything you see and grade is limited to your own group.</li>
            </ul>
          </section>

          <section className={guide.section}>
            <h2>Something wrong?</h2>
            <p>Read the alert, refresh, and try once more. If it still fails, send a Course Lead the page, the student or record involved, the time, and the exact error. You can also use <strong>Support</strong> in the top bar.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
