import LeadSidebar from "./components/LeadSidebar.js";

export const metadata = {
  title: "Course Lead",
  description: "Course Lead layout",
};

export default function CourseLeadLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <LeadSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
