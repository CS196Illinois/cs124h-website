"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // Matches the CSS breakpoint in Navbar.module.css: below this width the
      // full row of nav buttons doesn't fit on one line (labels wrap inside
      // the fixed-height bar and later items get pushed off-screen), so the
      // mobile hamburger menu takes over well before the old 768px cutoff.
      setIsMobile(window.innerWidth <= 1280);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleLinkClick = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div>
      <nav className={styles.navbar}>
        {/* Logo - left side, links to home */}
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink} aria-label="Go to home">
            <Image
              src="/images/cs124h-logo.png"
              alt="CS124H Logo"
              height={40}
              width={40}
              className={styles.logo}
              priority
            />
          </Link>
        </div>

        {/* Mobile hamburger menu */}
        {isMobile && (
          <button
            className={styles["hamburger-menu"]}
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            <span className={styles["hamburger-line"]}></span>
            <span className={styles["hamburger-line"]}></span>
            <span className={styles["hamburger-line"]}></span>
          </button>
        )}

        {/* Desktop navigation */}
        <div
          className={`${styles["nav-items"]} ${isMobile ? styles.hidden : ""}`}
        >
          <Link href="/">
            <button
              className={`${styles["nav-button"]} ${styles["home-button"]}  ${
                pathname === "/" ? styles.active : ""
              }`}
            >
              Home
            </button>
          </Link>
          <div>
            <button
              onClick={() => {
                if (!session) {
                  signIn("cilogon", { callbackUrl: "/user" })
                }
                router.push("/user");
              }}
              className={`${styles["nav-button"]} ${
                pathname === `/user/${session?.user?.role}` ? styles.active : ""
              }`}
            >
              Dashboard
            </button>
          </div>
          <Link href="/hall_of_fame">
            <button
              className={`${styles["nav-button"]} ${
                pathname === "/hall_of_fame" ? styles.active : ""
              }`}
            >
              ⭐ Hall Of Fame ⭐
            </button>
          </Link>
          <Link href="/resources">
            <button
              className={`${styles["nav-button"]} ${
                pathname === "/resources" ? styles.active : ""
              }`}
            >
              Resources
            </button>
          </Link>
          <Link href="/course_staff">
            <button
              className={`${styles["nav-button"]} ${
                pathname === "/course_staff" ? styles.active : ""
              }`}
            >
              Course Staff
            </button>
          </Link>
          <Link href="/leaderboard">
            <button
              className={`${styles["nav-button"]} ${
                pathname === "/leaderboard" ? styles.active : ""
              }`}
            >
              Leaderboard
            </button>
          </Link>
          <Link href="/timeline">
            <button
              className={`${styles["nav-button"]} ${
                pathname === "/timeline" ? styles.active : ""
              }`}
            >
              Timeline
            </button>
          </Link>
          <div>
            {status === "loading" ? (
              <button className={styles["nav-button"]}>Loading…</button>
            ) : session ? (
              <button
                className={styles["nav-button"]}
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Logout
              </button>
            ) : (
              <button
                className={styles["nav-button"]}
                onClick={() => signIn("cilogon", { callbackUrl: "/user" })}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      {isMobile && (
        <div>
          {/* Overlay */}
          <div
            className={`${styles.overlay} ${
              isSidebarOpen ? styles.active : ""
            }`}
            onClick={handleLinkClick}
          ></div>

          {/* Sidebar */}
          <div
            className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}
          >
            <div className={styles["sidebar-content"]}>
              <Link href="/" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    styles["home-button"]
                  } ${pathname === "/" ? styles.active : ""}`}
                >
                  Home
                </button>
              </Link>
              <div>
                <button
                  onClick={() => {
                    if (!session) {
                      signIn("cilogon", { callbackUrl: "/user" })
                    }
                    router.push("/user");
                  }}
                  className={`${styles["nav-button"]} ${
                    pathname === `/user/${session?.user?.role}` ? styles.active : ""
                  }`}
                >
                  Dashboard
                </button>
              </div>
              <Link href="/hall_of_fame" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    pathname === "/hall_of_fame" ? styles.active : ""
                  }`}
                >
                  ⭐ Hall Of Fame ⭐
                </button>
              </Link>
              <Link href="/resources" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    pathname === "/resources" ? styles.active : ""
                  }`}
                >
                  Resources
                </button>
              </Link>
              <Link href="/course_staff" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    pathname === "/course_staff" ? styles.active : ""
                  }`}
                >
                  Course Staff
                </button>
              </Link>
              <Link href="/leaderboard" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    pathname === "/leaderboard" ? styles.active : ""
                  }`}
                >
                  Leaderboard
                </button>
              </Link>
              <Link href="/timeline" onClick={handleLinkClick}>
                <button
                  className={`${styles["nav-button"]} ${
                    pathname === "/timeline" ? styles.active : ""
                  }`}
                >
                  Timeline
                </button>
              </Link>
              <div>
                {status === "loading" ? (
                  <button className={styles["nav-button"]}>Loading…</button>
                ) : session ? (
                  <button
                    className={styles["nav-button"]}
                    onClick={() => { handleLinkClick(); signOut({ callbackUrl: "/" }); }}
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    className={styles["nav-button"]}
                    onClick={() => signIn("cilogon", { callbackUrl: "/user" })}
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
