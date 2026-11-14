"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./SignIn.module.css";

function SignInInner() {
  const searchParams = useSearchParams();
  // Read once: the param is then dropped from the URL so a refresh starts clean
  // instead of showing a stale "session expired" message (the middleware has
  // already cleared the unreadable cookie by the time this page loads).
  const [error] = useState(() => searchParams?.get("error"));
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const inFlight = useRef(false);
  async function begin() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure("");
    try {
      const reset = await fetch("/api/auth/reset", { method: "POST" });
      if (!reset.ok) throw new Error();
      const target = new URL(searchParams.get("callbackUrl") || "/user", window.location.origin);
      const callbackUrl = target.origin === window.location.origin && (target.pathname === "/user" || target.pathname.startsWith("/user/"))
        ? target.pathname + target.search : "/user";
      await signIn("cilogon", { callbackUrl });
    } catch {
      setFailure("Sign-in could not start. Check your connection and try again, or submit a support ticket.");
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <main className={`page ${styles.page}`}>
      <div className={styles.panel}>
        <h1>Sign in</h1>
        <p className={styles.lede}>Use your University of Illinois account to open your CS 124 Honors dashboard.</p>
        {error && (
          <p className={styles.notice} role="alert">
            {error === "SessionExpired"
              ? "Your session expired or could not be read. Sign in below to start a fresh session."
              : "We couldn't complete your sign-in. Please try again. If it keeps happening, submit a support ticket so we can help."}
          </p>
        )}
        {failure && <p role="alert" className={styles.notice}>{failure}</p>}
        <button type="button" className={`btn btnPrimary ${styles.signIn}`} disabled={busy} onClick={begin}>
          {busy ? "Opening Illinois sign-in…" : "Sign in with Illinois"}
        </button>
        <p className={styles.help}>Having trouble? <Link href="/support">Submit a support ticket</Link>.</p>
      </div>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<main className="page"><p>Loading sign-in…</p></main>}>
      <SignInInner />
    </Suspense>
  );
}
