import { SITE } from "../../lib/siteConfig";

export const metadata = { title: "Assignments" };

// Placeholder until the assignments page lands (revamp phase 4).
export default function AssignmentsPage() {
  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Assignments</h1>
        <p>MPs and sprint work for {SITE.semester}, with your progress and links to PrairieLearn.</p>
      </header>
      <div>
        <p>Assignments will be listed here once the {SITE.semester} MPs are posted.</p>
      </div>
    </main>
  );
}
