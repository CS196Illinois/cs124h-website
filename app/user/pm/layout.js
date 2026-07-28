import PMSidebar from "./components/PMSidebar.js";

export const metadata = {
  title: "PM",
  description: "PM layout",
};

export default function PMLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <PMSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
