import { getSessionUser } from "../../lib/session";
import PeopleCourseLead from "../../components/staff/PeopleCourseLead";
import PeopleHeadPM from "../../components/staff/PeopleHeadPM";

export const metadata = { title: "People" };

// Course leads and head PMs only (middleware.js). Course leads manage
// everyone; head PMs manage PMs and students (enforced by the users API).
export default async function PeoplePage() {
  const { role } = await getSessionUser();
  return (
    <main className="page">
      {role === "course_lead" ? <PeopleCourseLead /> : <PeopleHeadPM />}
    </main>
  );
}
