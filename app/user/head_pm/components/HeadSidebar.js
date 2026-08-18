import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/",             label: "Dashboard"    },
  { href: "/people",       label: "People"       },
  { href: "/action_items", label: "Action Items" },
  { href: "/gradebook",    label: "Gradebook"    },
  { href: "/events",       label: "Events"       },
  { href: "/sprints",      label: "Sprints"      },
];

export default function HeadSidebar() {
  return (
    <RoleSidebar
      links={links}
      base="/user/head_pm"
      roleTitle="Head PM"
      ownRole="head_pm"
    />
  );
}
