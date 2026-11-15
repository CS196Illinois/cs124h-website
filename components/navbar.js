"use client";

import { useEffect, useState } from "react";
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

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      {...extra}
    >
      {item.label}
    </Link>
  );

  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Main">
        <Link href="/" className={styles.brand} aria-label={`${SITE.shortName} home`}>
          <Image src="/images/cs124h-logo.png" alt="" width={26} height={26} priority />
          <span>{SITE.shortName}</span>
        </Link>

        <ul id="main-nav" className={`${styles.links} ${menuOpen ? styles.linksOpen : ""}`}>
          {NAV_ITEMS.map((item) => <li key={item.href}>{navLink(item)}</li>)}
          {tools.length > 0 && (
            // The signed-in role's own tabs, after the public pages.
            <li className={styles.roleTabs} data-tour="role-tools">
              <ul aria-label={`${ROLE_NAMES[role]} tools`}>
                {tools.map((tool) => <li key={tool.href}>{navLink(tool, { "data-tour": dataTour(tool.label) })}</li>)}
              </ul>
            </li>
          )}
          {account && <li className={styles.mobileAccount}>{account}</li>}
        </ul>

        <div className={styles.actions}>
          <ThemeToggle />
          {account && <div className={styles.desktopAccount}>{account}</div>}
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
          >
            {menuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>
        </div>
      </nav>
      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />}
    </header>
  );
}
