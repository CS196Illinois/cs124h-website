import WebSidebar from "./components/WebSidebar.js";

export const metadata = {
  title: "Web Dev",
  description: "Web Dev layout",
};

export default function WebDevLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <WebSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
