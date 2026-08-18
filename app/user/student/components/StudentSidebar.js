import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/action_items", label: "Action Items" },
  { href: "/attendance",   label: "Attendance"   },
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
