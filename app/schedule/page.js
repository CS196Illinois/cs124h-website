import { SITE } from "../../lib/siteConfig";

export const metadata = { title: "Schedule" };

// Placeholder until the timeline view lands (revamp phase 3).
export default function SchedulePage() {
  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Schedule</h1>
        <p>Every sprint, MP, event, and deadline for {SITE.semester} on one timeline.</p>
      </header>
      <div className="card" style={{ padding: "1.25rem 1.4rem" }}>
        <p>
          The timeline is being built. For now, see the{" "}
          <a href={SITE.links.calendar} target="_blank" rel="noopener noreferrer">course Google Calendar</a>.
        </p>
      </div>
    </main>
  );
}
