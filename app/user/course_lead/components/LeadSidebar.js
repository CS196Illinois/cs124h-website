import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/people",       label: "People"       },
  { href: "/action_items", label: "Action Items" },
  { href: "/gradebook",    label: "Gradebook"    },
  { href: "/events",       label: "Events"       },
  { href: "/sprints",      label: "Sprints"      },
  { href: "/user/checkin", label: "Attendance", absolute: true },
];

export default function LeadSidebar() {
  return (
    <RoleSidebar
      links={links}
      base="/user/course_lead"
      roleTitle="Course Lead"
      ownRole="course_lead"
    />
  );
}
