import HeadSidebar from "./components/HeadSidebar.js";

export const metadata = {
  title: "Head PM",
  description: "Head PM layout",
};

export default function HeadPMLayout({ children }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
      <HeadSidebar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
