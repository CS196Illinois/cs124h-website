import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/students",     label: "My Students"  },
  { href: "/action_items", label: "Action Items" },
  { href: "/gradebook",    label: "Gradebook"    },
  { href: "/events",       label: "Events"       },
];

export default function PMSidebar() {
  return (
    <RoleSidebar
      links={links}
      base="/user/pm"
      roleTitle="PM"
      ownRole="pm"
    />
  );
}
