"use client";

import RoleSidebar from "../../components/RoleSidebar";

const links = [
  { href: "/support",       label: "Support Tickets" },
  { href: "/events",        label: "Events"        },
  { href: "/user/checkin",  label: "Attendance", absolute: true },
];

export default function LeadWebSidebar() {
  return <RoleSidebar links={links} base="/user/lead_web_dev" roleTitle="Lead Web Dev" ownRole="lead_web_dev" />;
}
