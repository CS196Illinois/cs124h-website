"use client";

import { useSession } from "next-auth/react";
import StudentSidebar from "../student/components/StudentSidebar";
import PMSidebar from "../pm/components/PMSidebar";
import HeadSidebar from "../head_pm/components/HeadSidebar";
import LeadSidebar from "../course_lead/components/LeadSidebar";
import LeadWebSidebar from "../lead_web_dev/components/LeadWebSidebar";
import WebSidebar from "../web_dev/components/WebSidebar";

const SIDEBAR_BY_ROLE = {
  student: StudentSidebar,
  pm: PMSidebar,
  head_pm: HeadSidebar,
  course_lead: LeadSidebar,
  lead_web_dev: LeadWebSidebar,
  web_dev: WebSidebar,
};

// /user/checkin is role-agnostic (any signed-in role can check in, see
// middleware.js's SHARED_PATHS) - unlike every other /user/<role> section
// it isn't nested inside one role's own layout.js, which would only ever
// render that one role's sidebar. This picks whichever sidebar matches the
// signed-in user's actual role instead, so the page is never missing one.
export default function CheckInLayout({ children }) {
  const { data: session, status } = useSession();
  const Sidebar = SIDEBAR_BY_ROLE[session?.user?.role];

  if (status === "loading") return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      {Sidebar && <Sidebar />}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
