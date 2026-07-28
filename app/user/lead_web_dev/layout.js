import LeadWebSidebar from "./components/LeadWebSidebar.js";

export const metadata = {
  title: "Lead Web Dev",
  description: "Lead Web Dev layout",
};

export default function LeadWebDevLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <LeadWebSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
