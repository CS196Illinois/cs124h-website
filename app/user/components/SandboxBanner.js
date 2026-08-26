"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Small always-visible indicator for the sidebar so it's never ambiguous
 * whether the dashboard is showing real or sandboxed data — the whole
 * safety property this feature exists for depends on that never being
 * silent. Renders nothing when sandbox mode is off.
 */
export default function SandboxBanner() {
  const { status } = useSession();
  const [mode, setMode] = useState("off");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/users/me/sandbox")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMode(d.mode))
      .catch(() => {});
  }, [status]);

  // SandboxPanel dispatches this after a successful mode change so the
  // sidebar reflects it immediately instead of waiting for a reload.
  useEffect(() => {
    const onChange = (e) => setMode(e.detail.mode);
    window.addEventListener("sandbox-mode-changed", onChange);
    return () => window.removeEventListener("sandbox-mode-changed", onChange);
  }, []);

  if (mode === "off") return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem",
        background: "rgba(236,181,87,0.15)", border: "1px solid rgba(236,181,87,0.35)",
        borderRadius: "6px", padding: "0.35rem 0.6rem", marginBottom: "0.75rem",
        color: "#ecb557", fontFamily: "Inter", fontSize: "0.72rem", fontWeight: 600,
      }}
    >
      Sandbox active {mode === "ephemeral" ? "(ephemeral)" : "(persistent)"}
    </div>
  );
}
