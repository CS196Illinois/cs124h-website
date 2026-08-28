"use client";

import { signOut } from "next-auth/react";
import styles from "./Unauthorized.module.css";

// Sessions don't re-check the roster on their own (see app/unauthorized/page.js
// for why) — signing out and back in is the actual, reliable way for a
// newly-added roster entry to take effect, so this is offered as a real
// action here rather than just being mentioned in the copy.
export default function SignOutButton() {
  return (
    <button className={styles.signInButton} onClick={() => signOut({ callbackUrl: "/" })}>
      Sign Out
    </button>
  );
}
