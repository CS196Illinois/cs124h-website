"use client";

import RoleBadge from "./RoleBadge";

export default function PersonAccordion({
  netId,
  user,
  openCount,
  totalCount,
  isCollapsed,
  onToggle,
  showRole = true,
  showGroup = false,
  children,
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0.6rem 1rem", cursor: "pointer",
          background: "rgba(255,255,255,0.04)", borderRadius: "8px",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{isCollapsed ? "▶" : "▼"}</span>
        <span style={{ color: "#f9f9f9", fontWeight: 600, fontFamily: "Inter" }}>
          {user?.name || netId}
        </span>
        {user?.name && (
          <span style={{ color: "rgba(249,249,249,0.4)", fontFamily: "monospace", fontSize: "0.82rem" }}>
            {netId}
          </span>
        )}
        {showRole && user?.role && <RoleBadge roleId={user.role} />}
        {showGroup && user?.group_number && (
          <span style={{ color: "rgba(249,249,249,0.35)", fontSize: "0.78rem" }}>
            Group {user.group_number}
          </span>
        )}
        <span style={{
          marginLeft: "auto",
          background: openCount > 0 ? "rgba(225,145,48,0.2)" : "rgba(255,255,255,0.07)",
          color: openCount > 0 ? "#e19130" : "rgba(249,249,249,0.5)",
          borderRadius: "10px", padding: "0.1rem 0.55rem",
          fontSize: "0.75rem", fontWeight: 600,
        }}>
          {totalCount} item{totalCount !== 1 ? "s" : ""}
          {openCount > 0 && ` · ${openCount} open`}
        </span>
      </div>
      {!isCollapsed && children}
    </div>
  );
}
