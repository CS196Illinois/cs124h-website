"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { List, X, Sun, Moon } from "@phosphor-icons/react";
import styles from "./Navbar.module.css";
import { NAV_ITEMS, SITE, ROLE_NAMES, ROLE_TOOLS } from "../lib/siteConfig";

const isActive = (pathname, href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

function ThemeToggle() {
  // null until mounted: the server can't know the viewer's theme, and the
  // inline script in layout.js has already applied it before paint.
  const [dark, setDark] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    const resolve = () => root.dataset.theme === "dark" || (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(resolve());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(resolve());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setDark(!dark);
  };

  return (
    <button type="button" className={styles.iconButton} onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export default function Navbar() {
  const pathname = usePathname() || "/";
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // While true the menu plays its closing animation before it's removed.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const openRef = useRef(false); // current open state, readable from callbacks
  useEffect(() => { openRef.current = menuOpen; }, [menuOpen]);
  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setMenuOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setClosing(false), 160);
  }, []);
  const toggleMenu = () => {
    if (openRef.current) return closeMenu();
    clearTimeout(closeTimer.current);
    setClosing(false);
    openRef.current = true;
    setMenuOpen(true);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => closeMenu(), [pathname, closeMenu]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  const role = session?.user?.role;
  const signedIn = status === "authenticated" && Boolean(ROLE_NAMES[role]);
  const tools = signedIn ? ROLE_TOOLS[role] || [] : [];
  const account = status === "loading" ? null : signedIn ? (
    <button type="button" className={styles.signOut} onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
  ) : (
    <Link href="/signin" className={styles.accountLink}>Sign in</Link>
  );
  const dataTour = (label) => `tool-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const navLink = (item, extra = {}) => (
    <Link
      href={item.href}
      className={`${styles.link} ${isActive(pathname, item.href) ? styles.active : ""}`}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      {...(item.short ? { "aria-label": item.label } : {})}
      {...extra}
    >
      {item.short ? (
        <>
          <span className={styles.labelFull}>{item.label}</span>
          <span className={styles.labelShort} aria-hidden="true">{item.short}</span>
        </>
      ) : item.label}
    </Link>
  );
  const extras = NAV_ITEMS.filter((item) => !item.core);
  const roleTabs = (inMenu) => tools.length > 0 && (
    // The signed-in role's own tabs, after the public pages.
    <li className={`${styles.roleTabs} ${inMenu ? "" : styles.extra}`} data-tour={inMenu ? undefined : "role-tools"} data-label={ROLE_NAMES[role]}>
      <ul aria-label={`${ROLE_NAMES[role]} tools`}>
        {tools.map((tool) => <li key={tool.href}>{navLink(tool, inMenu ? {} : { "data-tour": dataTour(tool.label) })}</li>)}
      </ul>
    </li>
  );

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Main">
        <Link href="/" className={styles.brand} aria-label={`${SITE.shortName} home`}>
          <Image src="/images/cs124h-logo.png" alt="" width={26} height={26} priority />
          <span>{SITE.shortName}</span>
        </Link>

        {/* Every page in order; non-core ones hide below 1240px and move into the menu. */}
        <ul className={styles.links}>
          {NAV_ITEMS.map((item) => <li key={item.href} className={item.core ? undefined : styles.extra}>{navLink(item)}</li>)}
          {roleTabs(false)}
        </ul>

        <div className={styles.actions}>
          <span className={styles.themeInline}><ThemeToggle /></span>
          {account}
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
          >
            {menuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>
        </div>

        {/* The menu: only what doesn't fit in the bar. */}
        <ul id="main-nav" className={`${styles.menuPanel} ${menuOpen ? styles.menuOpen : closing ? styles.menuClosing : ""}`}>
          {extras.map((item) => <li key={item.href}>{navLink(item)}</li>)}
          {roleTabs(true)}
          <li className={styles.menuTheme}><ThemeToggle /> <span>Theme</span></li>
        </ul>
      </nav>
      {(menuOpen || closing) && (
        <div className={`${styles.backdrop} ${closing ? styles.backdropClosing : ""}`} onClick={closeMenu} aria-hidden="true" />
      )}
    </header>
  );
}
