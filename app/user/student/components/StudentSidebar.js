import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/action_items", label: "Action Items" },
  { href: "/user/checkin", label: "Attendance", absolute: true },
];

export default function StudentSidebar() {
  return (
    <RoleSidebar
      links={links}
      base="/user/student"
      roleTitle="Student"
      ownRole="student"
    />
  );
}
