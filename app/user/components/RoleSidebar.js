"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import styles from "./UserSidebar.module.css";

export default function RoleSidebar({ links, base, roleTitle, ownRole, banner, children }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const linkRefs = useRef([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sessionRole = session?.user?.role;
  const effectiveBase = base ?? (sessionRole ? `/user/${sessionRole}` : null);
  const isRoleViewing = ownRole && sessionRole && sessionRole !== ownRole;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // `absolute: true` links (shared, role-agnostic pages like /user/checkin)
  // use their href as-is instead of being prefixed with this role's base.
  const resolveHref = (link) => (link.absolute ? link.href : link.href === "/" ? effectiveBase : `${effectiveBase}${link.href}`);

  useEffect(() => {
    if (!effectiveBase) return;
    const activeIdx = links.findIndex((link) => {
      const fullHref = resolveHref(link);
      return link.href === "/"
        ? pathname === fullHref
        : pathname === fullHref || pathname.startsWith(`${fullHref}/`);
    });
    if (activeIdx >= 0 && linkRefs.current[activeIdx]) {
      const el = linkRefs.current[activeIdx];
      setIndicatorStyle({ top: el.offsetTop, height: el.offsetHeight });
    }
  }, [pathname, effectiveBase, links]);

  if (status === "loading" || !effectiveBase) return null;

  const sidebarContent = (
    <>
      <div className={styles.siteTitle}>CS 124H</div>
      <div className={styles.roleTitle}>{roleTitle}</div>
      {session?.user?.name && <div className={styles.userName}>{session.user.name}</div>}
      {banner}
      {isRoleViewing && (
        <Link
          href={`/user/${sessionRole}`}
          className={styles.link}
          style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "0.5rem" }}
        >
          ← My Dashboard
        </Link>
      )}
      <div className={styles.linkGroup}>
        <div
          className={styles.indicator}
          style={{
            top: indicatorStyle.top,
            height: indicatorStyle.height,
            opacity: indicatorStyle.height > 0 ? 1 : 0,
          }}
        />
        {links.map((link, i) => {
          const fullHref = resolveHref(link);
          const isActive = link.href === "/"
            ? pathname === fullHref
            : pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <Link
              key={link.href}
              href={fullHref}
              ref={(el) => { linkRefs.current[i] = el; }}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      {children}
      <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: "/" })}>
        Logout
      </button>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button
          className={styles.mobileToggle}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>

        <div
          className={`${styles.backdrop} ${sidebarOpen ? styles.backdropVisible : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarMobileOpen : ""}`}>
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className={styles.sidebar}>
      {sidebarContent}
    </aside>
  );
}
