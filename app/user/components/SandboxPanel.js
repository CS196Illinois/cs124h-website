"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../dashboard.module.css";

const SANDBOX_MODES = [
  { id: "off", label: "Off", desc: "Changes go to the real database, same as any other staff role." },
  { id: "ephemeral", label: "Ephemeral", desc: "Sandbox clears automatically after a while away from the dashboard." },
  { id: "persistent", label: "Persistent", desc: "Sandbox stays until you reset it or your access changes." },
];

/**
 * Self-contained sandbox mode toggle + reset control, shared by the web_dev
 * and lead_web_dev dashboards. Only ever reads/writes the current user's own
 * setting via /api/users/me/sandbox — never another user's.
 */
export default function SandboxPanel() {
  const { status } = useSession();
  const [mode, setMode] = useState("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const fetchMode = useCallback(async () => {
    const res = await fetch("/api/users/me/sandbox");
    if (res.ok) setMode((await res.json()).mode);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchMode();
  }, [status, fetchMode]);

  const handleModeChange = async (next) => {
    if (next === mode || saving) return;
    setSaving(true);
    setResetMsg("");
    const res = await fetch("/api/users/me/sandbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    if (res.ok) {
      setMode(next);
      // SandboxBanner (sidebar) fetches its own state independently and
      // won't otherwise see this until the next navigation/reload.
      window.dispatchEvent(new CustomEvent("sandbox-mode-changed", { detail: { mode: next } }));
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    const res = await fetch("/api/users/me/sandbox", { method: "DELETE" });
    setResetMsg(res.ok ? "Sandbox reset." : "Reset failed — try again.");
    setSaving(false);
  };

  return (
    <div className={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>Sandbox Mode</span>
      </div>
      <p style={{ color: "rgba(249,249,249,0.5)", fontFamily: "Inter", fontSize: "0.78rem", lineHeight: 1.5, marginBottom: "0.9rem" }}>
        When on, your changes to events, sprints, and action items never touch real data — only you see them.
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonBlock} style={{ height: "2.6rem", borderRadius: "8px" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.9rem" }}>
          {SANDBOX_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModeChange(m.id)}
              disabled={saving}
              aria-pressed={mode === m.id}
              style={{
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                cursor: saving ? "default" : "pointer",
                background: mode === m.id ? "rgba(236,181,87,0.15)" : "rgba(255,255,255,0.04)",
                border: mode === m.id ? "1px solid rgba(236,181,87,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: mode === m.id ? "#ecb557" : "#f9f9f9",
                fontFamily: "Inter",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>{m.desc}</div>
            </button>
          ))}
        </div>
      )}

      {!loading && mode !== "off" && (
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          style={{
            width: "100%", padding: "0.5rem", borderRadius: "6px", cursor: saving ? "default" : "pointer",
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
            color: "#f87171", fontFamily: "Inter", fontSize: "0.82rem",
          }}
        >
          Reset Sandbox
        </button>
      )}
      {resetMsg && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.76rem", fontFamily: "Inter", color: "rgba(249,249,249,0.5)" }}>{resetMsg}</div>
      )}
    </div>
  );
}
