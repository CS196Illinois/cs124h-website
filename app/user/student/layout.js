import StudentSidebar from "./components/StudentSidebar.js";

export const metadata = {
  title: "Student",
  description: "Student layout",
};

export default function StudentLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <StudentSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
